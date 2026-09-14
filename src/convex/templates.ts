import { query } from "./_generated/server";
import { TEMPLATE_PICKER } from "../lib/projectTemplates";

export const listTemplates = query({
  args: {},
  handler: async () => {
    return TEMPLATE_PICKER.map((t) => ({
      key: t.key,
      label: t.label,
      language: t.language,
      fileCount: t.files.length,
    }));
  },
});
