// Screens use the UI kit, never raw form elements (epic #163, #465): the kit's `Button` and
// `Field` controls carry the labels, focus rings, sizes and states every screen needs, so a raw
// `<button>`, `<a>` or `<input>` outside `src/platform/ui/` skips them. `react/forbid-elements` comes with
// eslint-config-next's React plugin, so this needs no `no-restricted-syntax` block (which, in flat
// config, would replace the theme rules' selectors for the same files instead of adding to them).

const use = (component) => `Use ${component} from src/platform/ui (#163)`

export const uiKitConfig = {
  files: ['src/**/*.tsx'],
  ignores: [
    // The kit itself
    'src/platform/ui/**',
    'src/**/*.test.tsx',
    'src/app/(payload)/**',
    // Payload admin components render inside Payload's own admin UI and styles, not the site's
    'src/platform/payload/admin/**',
  ],
  rules: {
    'react/forbid-elements': [
      'error',
      {
        forbid: [
          { element: 'a', message: use('Link (also for # links), or Button with href') },
          { element: 'button', message: use('Button') },
          { element: 'input', message: use('Field.Input or Field.Checkbox') },
          { element: 'select', message: use('Field.Select') },
          { element: 'textarea', message: use('Field.TextArea') },
        ],
      },
    ],
  },
}
