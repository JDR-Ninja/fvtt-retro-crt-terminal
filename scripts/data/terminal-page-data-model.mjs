import { ACCESS, LOCK_TYPES, PAGE_TYPES, VISIBILITY } from "../constants.mjs";

const FIELDS = "RETRO_CRT_TERMINAL.Fields";
const HINTS = "RETRO_CRT_TERMINAL.Hints";

/** Maps enum values to the localization keys the page sheet renders as option labels. */
function choices(group, values) {
  return Object.fromEntries(values.map(value => [
    value,
    `RETRO_CRT_TERMINAL.${group}.${value[0].toUpperCase()}${value.slice(1)}`
  ]));
}

export const PAGE_TYPE_CHOICES = Object.freeze(choices("PageTypes", PAGE_TYPES));
export const VISIBILITY_CHOICES = Object.freeze(choices("States", Object.values(VISIBILITY)));
export const ACCESS_CHOICES = Object.freeze(choices("States", Object.values(ACCESS)));
export const LOCK_TYPE_CHOICES = Object.freeze(choices("LockTypes", LOCK_TYPES));

export class TerminalPageDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      source: new fields.StringField({
        required: true,
        nullable: false,
        initial: "",
        label: `${FIELDS}.Source`,
        hint: `${HINTS}.Source`
      }),
      pageId: new fields.StringField({
        required: true,
        nullable: false,
        initial: "",
        label: `${FIELDS}.PageId`,
        hint: `${HINTS}.PageId`
      }),
      pageType: new fields.StringField({
        required: true,
        nullable: false,
        initial: "document",
        choices: PAGE_TYPE_CHOICES,
        label: `${FIELDS}.PageType`,
        hint: `${HINTS}.PageType`
      }),
      navigation: new fields.SchemaField({
        label: new fields.StringField({
          required: true,
          nullable: false,
          initial: "",
          label: `${FIELDS}.MenuLabel`,
          hint: `${HINTS}.MenuLabel`
        }),
        parent: new fields.StringField({
          required: true,
          nullable: false,
          initial: "",
          label: `${FIELDS}.Parent`,
          hint: `${HINTS}.Parent`
        }),
        sort: new fields.NumberField({
          required: true,
          nullable: false,
          integer: true,
          initial: 0,
          label: `${FIELDS}.Sort`,
          hint: `${HINTS}.PageSort`
        }),
        showInParentMenu: new fields.BooleanField({
          required: true,
          nullable: false,
          initial: true,
          label: `${FIELDS}.ShowInMenu`,
          hint: `${HINTS}.ShowInMenu`
        })
      }),
      release: new fields.SchemaField({
        visibility: new fields.StringField({
          required: true,
          nullable: false,
          initial: VISIBILITY.VISIBLE,
          choices: VISIBILITY_CHOICES,
          label: `${FIELDS}.Visibility`,
          hint: `${HINTS}.Visibility`
        }),
        access: new fields.StringField({
          required: true,
          nullable: false,
          initial: ACCESS.AVAILABLE,
          choices: ACCESS_CHOICES,
          label: `${FIELDS}.Access`,
          hint: `${HINTS}.Access`
        })
      }),
      lock: new fields.SchemaField({
        type: new fields.StringField({
          required: true,
          nullable: false,
          initial: "none",
          choices: LOCK_TYPE_CHOICES,
          label: `${FIELDS}.LockType`,
          hint: `${HINTS}.LockType`
        }),
        secret: new fields.StringField({
          required: true,
          nullable: false,
          initial: "",
          label: `${FIELDS}.Password`,
          hint: `${HINTS}.Password`
        }),
        failureMessage: new fields.StringField({
          required: true,
          nullable: false,
          initial: "ACCESS DENIED",
          label: `${FIELDS}.FailureMessage`,
          hint: `${HINTS}.FailureMessage`
        })
      }),
      presentation: new fields.SchemaField({
        themeOverride: new fields.StringField({
          required: true,
          nullable: false,
          initial: "",
          label: `${FIELDS}.ThemeOverride`,
          hint: `${HINTS}.ThemeOverride`
        }),
        startFocusedElement: new fields.StringField({ required: true, nullable: false, initial: "" })
      })
    };
  }
}
