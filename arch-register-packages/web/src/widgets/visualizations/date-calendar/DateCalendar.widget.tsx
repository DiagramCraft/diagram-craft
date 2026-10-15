import { TbCalendarMonth } from "react-icons/tb";
import { defineWidget } from "../../shared/defineWidget";
import { DateCalendarConfigForm } from "./DateCalendarConfigForm";
import { DateCalendarWidget } from "./DateCalendar";
import { dateCalendarWidgetConfigSchema } from "./types";

export default defineWidget({
  type: "DateCalendar",
  category: "visualizations",
  name: "Calendar",
  description:
    "Records placed on a month or week calendar by a date field, e.g. renewals or reviews.",
  icon: TbCalendarMonth,
  component: DateCalendarWidget,
  configForm: DateCalendarConfigForm,
  configSchema: dateCalendarWidgetConfigSchema,
  dashboard: {
    defaultW: 12,
    defaultH: 30,
    surfaces: ["workspace"],
  },
});
