"use client";

import { useState } from "react";
import type { Hackathon, Track } from "@prisma/client";
import { ActionForm } from "@/components/ActionForm";
import { EventDescription } from "@/components/EventDescription";
import styles from "./styles";
import { eventEditValues } from "@/lib/admin-edit";
import { localDateValue } from "./format";

type ContentRow = { id?: string; [key: string]: string | undefined };
type RepeaterProps = {
  name: string;
  initial: ContentRow[];
  first: string;
  second: string;
  firstLabel: string;
  secondLabel: string;
  addLabel: string;
  secondType?: string;
};

function Repeater({
  name,
  initial,
  first,
  second,
  firstLabel,
  secondLabel,
  addLabel,
  secondType = "text",
}: RepeaterProps) {
  const [rows, setRows] = useState<ContentRow[]>(initial);
  const update = (index: number, key: string, value: string) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  return (
    <div className={styles.repeater}>
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(
          rows.filter((row) => row[first]?.trim() || row[second]?.trim()),
        )}
      />
      {rows.map((row, index) => (
        <div className={styles.repeatRow} key={row.id || index}>
          <label className={styles.field}>
            {firstLabel}
            <input
              value={row[first] || ""}
              onChange={(event) => update(index, first, event.target.value)}
              aria-label={`${firstLabel} ${index + 1}`}
              maxLength={first === "time" || first === "name" ? 100 : 150}
            />
          </label>
          <label className={styles.field}>
            {secondLabel}
            <input
              value={row[second] || ""}
              type={secondType}
              onChange={(event) => update(index, second, event.target.value)}
              aria-label={`${secondLabel} ${index + 1}`}
              maxLength={
                name === "tracks" ? 1000 : name === "schedule" ? 300 : 2000
              }
            />
          </label>
          <button
            className={styles.remove}
            type="button"
            onClick={() =>
              setRows((current) => current.filter((_, i) => i !== index))
            }
            aria-label={`Remove ${name} item ${index + 1}`}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className={styles.add}
        type="button"
        onClick={() =>
          setRows((current) => [...current, { [first]: "", [second]: "" }])
        }
      >
        ＋ {addLabel}
      </button>
    </div>
  );
}

function contentRows(value: unknown): ContentRow[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is ContentRow =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      )
    : [];
}

export default function EventForm({
  event,
}: {
  event?: Hackathon & { tracks: Track[] };
}) {
  const timezone = event?.timezone || "Asia/Singapore";
  const [zone, setZone] = useState(timezone);
  const [description, setDescription] = useState(event?.description ?? "");
  return (
    <ActionForm intent="event.save">
      {event && <input type="hidden" name="id" value={event.id} />}
      {event && <input type="hidden" name="original" value={JSON.stringify(eventEditValues(event, event.tracks))} />}
      <section className={styles.formSection}>
        <h2>Make it your event</h2>
        <p>
          A clear name and a short invitation are all you need to get started.
        </p>
        <div className={styles.fields}>
          <label className={styles.field}>
            Hackathon name
            <input
              name="title"
              required
              maxLength={150}
              defaultValue={event?.title}
              placeholder="Build with Stripe"
            />
          </label>
          <div className={styles.columns}>
            <label className={styles.field}>
              Page URL
              <input
                name="slug"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                defaultValue={event?.slug}
                placeholder="build-with-stripe"
                readOnly={!!event && event.status !== "DRAFT"}
                maxLength={80}
              />
              <small>/hackathons/your-page-url · fixed after publishing</small>
            </label>
            <label className={styles.field}>
              Visibility
              <select name="status" defaultValue={event?.status || "DRAFT"}>
                <option
                  value="DRAFT"
                  disabled={!!event && event.status !== "DRAFT"}
                >
                  Draft — organizers only
                </option>
                <option value="ACTIVE">
                  Active — visible in the community
                </option>
                <option value="ENDED">Ended — keep the public gallery</option>
              </select>
            </label>
          </div>
          <label className={styles.field}>
            Short introduction
            <input
              name="tagline"
              maxLength={250}
              defaultValue={event?.tagline}
              placeholder="An afternoon of big ideas, new connections, and working prototypes."
            />
            <small>Displayed on the event directory and gallery header.</small>
          </label>
          <label className={styles.field}>
            Event description
            <textarea
              name="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell participants what they’ll be building and what to expect."
              maxLength={20000}
            />
            <small>Markdown supported. Use *italic*, **bold**, or a list.</small>
          </label>
          <details>
            <summary>Preview event description</summary>
            {description.trim() ? <EventDescription>{description}</EventDescription> : <p>Enter a description to preview it here.</p>}
          </details>
          <div className={styles.columns}>
            <label className={styles.field}>
              Location
              <input
                name="location"
                defaultValue={event?.location ?? "Singapore"}
                placeholder="Venue in Singapore or online"
                maxLength={250}
              />
            </label>
            <label className={styles.field}>
              Event timezone
              <input
                name="timezone"
                list="event-timezones"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                required
              />
              <datalist id="event-timezones">
                <option value="Asia/Singapore" />
                <option value="America/Los_Angeles" />
                <option value="America/New_York" />
                <option value="Europe/London" />
                <option value="UTC" />
              </datalist>
              <small>
                {zone === "Asia/Singapore"
                  ? "All dates below use Singapore time (SGT, UTC+8)."
                  : "All dates below use this timezone."}
              </small>
            </label>
          </div>
        </div>
      </section>
      <section className={styles.formSection}>
        <h2>Set the pace</h2>
        <p>
          Submissions and voting have their own windows. You can close either
          early from event controls.
        </p>
        <div className={styles.fields}>
          <div className={styles.columns}>
            <label className={styles.field}>
              Event starts
              <input
                name="startsAt"
                type="datetime-local"
                defaultValue={localDateValue(event?.startsAt, timezone)}
                required
              />
            </label>
            <label className={styles.field}>
              Event ends
              <input
                name="endsAt"
                type="datetime-local"
                defaultValue={localDateValue(event?.endsAt, timezone)}
                required
              />
            </label>
          </div>
          <div className={styles.columns}>
            <label className={styles.field}>
              Submissions open
              <input
                name="submissionOpensAt"
                type="datetime-local"
                defaultValue={localDateValue(
                  event?.submissionOpensAt,
                  timezone,
                )}
                required
              />
            </label>
            <label className={styles.field}>
              Submissions close
              <input
                name="submissionClosesAt"
                type="datetime-local"
                defaultValue={localDateValue(
                  event?.submissionClosesAt,
                  timezone,
                )}
                required
              />
            </label>
          </div>
          <div className={styles.columns}>
            <label className={styles.field}>
              Voting opens
              <input
                name="votingOpensAt"
                type="datetime-local"
                defaultValue={localDateValue(event?.votingOpensAt, timezone)}
                required
              />
            </label>
            <label className={styles.field}>
              Voting closes
              <input
                name="votingClosesAt"
                type="datetime-local"
                defaultValue={localDateValue(event?.votingClosesAt, timezone)}
                required
              />
            </label>
          </div>
        </div>
      </section>
      <section className={styles.formSection}>
        <h2>Teams, tracks, and votes</h2>
        <p>
          Solo builders are welcome. Each team shares one project, and everyone
          gets the same voting allowance.
        </p>
        <div className={styles.columns3}>
          <label className={styles.field}>
            Maximum team size
            <input
              name="maxTeamSize"
              type="number"
              min={1}
              max={100}
              defaultValue={event?.maxTeamSize || 4}
              required
            />
          </label>
          <label className={styles.field}>
            Votes per person
            <input
              name="votesPerUser"
              type="number"
              min={0}
              max={100}
              defaultValue={event?.votesPerUser ?? 3}
              required
            />
          </label>
          <label className={styles.field}>
            Maximum tracks per project
            <input
              name="maxTrackSelections"
              type="number"
              min={1}
              max={100}
              defaultValue={event?.maxTrackSelections || 1}
              required
            />
          </label>
        </div>
        <hr className={styles.divider} />
        <p className={styles.subtle}>
          Leave tracks empty to hide them from submissions. If you add tracks,
          projects must select at least one.
        </p>
        <Repeater
          key={event?.tracks.map((track) => track.id).join(",")}
          name="tracks"
          initial={
            event?.tracks.map(({ id, name, description }) => ({
              id,
              name,
              description,
            })) || []
          }
          first="name"
          second="description"
          firstLabel="Track name"
          secondLabel="Description"
          addLabel="Add track"
        />
      </section>
      <section className={styles.formSection}>
        <h2>The participant briefing</h2>
        <p>Only imported participants and organizers can view these details.</p>
        <div className={styles.fields}>
          <label className={styles.field}>
            Meeting or livestream link
            <input
              name="meetingUrl"
              type="url"
              defaultValue={event?.meetingUrl || ""}
              placeholder="https://meet.google.com/…"
            />
          </label>
          <label className={styles.field}>
            Attendee information
            <textarea
              name="attendeeInfo"
              rows={4}
              defaultValue={event?.attendeeInfo}
              placeholder="Arrival instructions, Wi-Fi details, and anything else participants should know."
              maxLength={20000}
            />
          </label>
        </div>
        <hr className={styles.divider} />
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>Schedule</h3>
        <Repeater
          name="schedule"
          initial={contentRows(event?.schedule)}
          first="time"
          second="label"
          firstLabel="Time"
          secondLabel="Activity"
          addLabel="Add schedule item"
        />
        <hr className={styles.divider} />
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>Resources</h3>
        <Repeater
          name="resources"
          initial={contentRows(event?.resources)}
          first="title"
          second="url"
          firstLabel="Resource name"
          secondLabel="Link"
          secondType="url"
          addLabel="Add resource"
        />
        <hr className={styles.divider} />
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>Prizes</h3>
        <Repeater
          name="prizes"
          initial={contentRows(event?.prizes)}
          first="title"
          second="description"
          firstLabel="Prize name"
          secondLabel="Details"
          addLabel="Add prize"
        />
      </section>
      <div className={styles.saveBar}>
        <p>
          {event
            ? "Changes apply to this event immediately."
            : "Create a draft first, then invite your participants."}
        </p>
        <button className="button button-primary" type="submit">
          {event ? "Save event" : "Create hackathon"}
        </button>
      </div>
    </ActionForm>
  );
}
