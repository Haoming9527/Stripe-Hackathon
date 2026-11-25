import Markdown from "react-markdown";

export function EventDescription({ children }: { children: string }) {
  return <div className="prose event-markdown"><Markdown skipHtml>{children}</Markdown></div>;
}
