import { DEFAULT_TERMINAL_CONFIG } from "../constants.mjs";
import { themeSchemaFields } from "./terminal-theme-schema.mjs";

const FIELDS = "RETRO_CRT_TERMINAL.Fields";
const HINTS = "RETRO_CRT_TERMINAL.Hints";

/**
 * The terminal configuration stored on a Journal flag, expressed as a DataModel
 * so the configuration window can render, validate, and persist it from a single
 * schema instead of three hand-maintained copies.
 */
export class TerminalConfigModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const { launcher, behavior } = DEFAULT_TERMINAL_CONFIG;
    return {
      enabled: new fields.BooleanField({
        initial: DEFAULT_TERMINAL_CONFIG.enabled,
        label: `${FIELDS}.Enabled`,
        hint: `${HINTS}.Enabled`
      }),
      terminalId: new fields.StringField({
        required: true,
        blank: false,
        initial: "terminal",
        label: `${FIELDS}.TerminalId`,
        hint: `${HINTS}.TerminalId`
      }),
      label: new fields.StringField({
        required: true,
        blank: false,
        initial: "Terminal",
        label: `${FIELDS}.Label`,
        hint: `${HINTS}.Label`
      }),
      startPageUuid: new fields.StringField({
        required: true,
        blank: true,
        initial: DEFAULT_TERMINAL_CONFIG.startPageUuid,
        label: `${FIELDS}.StartPage`,
        hint: `${HINTS}.StartPage`
      }),
      themeId: new fields.StringField({
        required: true,
        blank: false,
        initial: DEFAULT_TERMINAL_CONFIG.themeId,
        label: `${FIELDS}.Theme`,
        hint: `${HINTS}.Theme`
      }),
      themeOverrides: new fields.SchemaField(themeSchemaFields()),
      launcher: new fields.SchemaField({
        published: new fields.BooleanField({
          initial: launcher.published,
          label: `${FIELDS}.Published`,
          hint: `${HINTS}.Published`
        }),
        sort: new fields.NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: launcher.sort,
          label: `${FIELDS}.Sort`,
          hint: `${HINTS}.Sort`
        }),
        icon: new fields.StringField({
          required: true,
          blank: false,
          initial: launcher.icon,
          label: `${FIELDS}.Icon`,
          hint: `${HINTS}.Icon`
        }),
        audience: new fields.StringField({ required: true, blank: false, initial: launcher.audience })
      }),
      behavior: new fields.SchemaField({
        showBootSequence: new fields.BooleanField({
          initial: behavior.showBootSequence,
          label: `${FIELDS}.BootSequence`,
          hint: `${HINTS}.BootSequence`
        }),
        rememberPage: new fields.BooleanField({
          initial: behavior.rememberPage,
          label: `${FIELDS}.RememberPage`,
          hint: `${HINTS}.RememberPage`
        }),
        closeOnEscapeAtRoot: new fields.BooleanField({
          initial: behavior.closeOnEscapeAtRoot,
          label: `${FIELDS}.CloseAtRoot`,
          hint: `${HINTS}.CloseAtRoot`
        })
      })
    };
  }
}
