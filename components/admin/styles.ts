import layout from "./styles/layout.module.css";
import forms from "./styles/forms.module.css";
import data from "./styles/data.module.css";

// Stable class-map interface; each selector remains scoped to its owning module.
const styles = { ...layout, ...forms, ...data };
export default styles;
