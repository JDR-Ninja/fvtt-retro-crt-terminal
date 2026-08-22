const FIELDS = "RETRO_CRT_TERMINAL.Fields";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Schema fields describing a resolved terminal theme. Shared by the terminal
 * configuration model and by the theme tab so bounds live in exactly one place.
 */
export function themeSchemaFields() {
  const fields = foundry.data.fields;
  return {
    typography: new fields.SchemaField({
      font: new fields.StringField({ required: true, blank: false, initial: "VT323", label: `${FIELDS}.Font` }),
      size: amount(fields, `${FIELDS}.FontSize`, { min: 10, max: 72, step: 1, initial: 20 }),
      lineHeight: amount(fields, `${FIELDS}.LineHeight`, { min: 0.8, max: 3, step: 0.05, initial: 1.35 }),
      letterSpacing: amount(fields, `${FIELDS}.LetterSpacing`, { min: -2, max: 12, step: 0.25, initial: 1 }),
      uppercase: new fields.BooleanField({ initial: false, label: `${FIELDS}.Uppercase` })
    }),
    colors: new fields.SchemaField({
      foreground: color(fields, `${FIELDS}.Foreground`, "#7dff8a"),
      background: color(fields, `${FIELDS}.Background`, "#031006"),
      muted: color(fields, `${FIELDS}.Muted`, "#41984c"),
      highlight: color(fields, `${FIELDS}.Highlight`, "#c8ffcd"),
      border: color(fields, `${FIELDS}.Border`, "#398644"),
      error: color(fields, `${FIELDS}.Error`, "#ff6464")
    }),
    effects: new fields.SchemaField({
      scanlines: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: true, label: `${FIELDS}.Scanlines` }),
        opacity: amount(fields, `${FIELDS}.Opacity`, { min: 0, max: 1, step: 0.01, initial: 0.14 }),
        size: amount(fields, `${FIELDS}.Size`, { min: 1, max: 10, step: 1, initial: 3 })
      }),
      glow: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: true, label: `${FIELDS}.Glow` }),
        strength: amount(fields, `${FIELDS}.Strength`, { min: 0, max: 1, step: 0.01, initial: 0.35 })
      }),
      flicker: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false, label: `${FIELDS}.Flicker` }),
        strength: amount(fields, `${FIELDS}.Strength`, { min: 0, max: 0.4, step: 0.01, initial: 0.03 }),
        speed: amount(fields, `${FIELDS}.Speed`, { min: 20, max: 1000, step: 10, initial: 140 })
      }),
      noise: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false, label: `${FIELDS}.Noise` }),
        strength: amount(fields, `${FIELDS}.Strength`, { min: 0, max: 0.4, step: 0.01, initial: 0.04 })
      }),
      vhs: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false, label: `${FIELDS}.Vhs` }),
        tracking: amount(fields, `${FIELDS}.Tracking`, { min: 0, max: 1, step: 0.01, initial: 0 }),
        jitter: amount(fields, `${FIELDS}.Jitter`, { min: 0, max: 8, step: 0.1, initial: 0 }),
        chromaticOffset: amount(fields, `${FIELDS}.ChromaticOffset`, { min: 0, max: 8, step: 0.1, initial: 0 })
      }),
      curvature: new fields.SchemaField({
        enabled: new fields.BooleanField({ initial: false, label: `${FIELDS}.Curvature` }),
        strength: amount(fields, `${FIELDS}.Strength`, { min: 0, max: 1, step: 0.01, initial: 0 })
      })
    })
  };
}

function amount(fields, label, { min, max, step, initial }) {
  return new fields.NumberField({ required: true, nullable: false, initial, min, max, step, label });
}

function color(fields, label, initial) {
  return new fields.StringField({
    required: true,
    nullable: false,
    initial,
    label,
    validate: value => HEX_COLOR.test(String(value)),
    validationError: "must be a #rrggbb color"
  });
}
