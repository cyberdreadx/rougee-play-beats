# 🌍 Internationalization (i18n) Setup Guide

## ✅ What's Been Set Up

I've implemented a complete i18n solution using `react-i18next`, which is the easiest and most popular way to add multiple languages to a React app.

## 📦 Installation

Run this command to install the required packages:

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

## 🗂️ File Structure

```
src/
├── i18n/
│   ├── config.ts              # i18n configuration
│   └── locales/
│       ├── en.json            # English
│       ├── es.json            # Spanish
│       ├── fr.json            # French
│       ├── de.json            # German
│       ├── ja.json            # Japanese
│       ├── zh.json            # Chinese
│       ├── pt.json            # Portuguese
│       └── ru.json            # Russian
└── components/
    └── LanguageSwitcher.tsx   # Language selector component
```

## 🚀 How It Works

1. **Automatic Language Detection**: The app automatically detects the user's browser language
2. **LocalStorage Persistence**: User's language choice is saved and remembered
3. **8 Languages Supported**: English, Spanish, French, German, Japanese, Chinese, Portuguese, Russian
4. **Easy to Extend**: Just add more translation files and update the config

## 💻 Usage in Components

### Basic Usage

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('nav.discover')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
}
```

### With Variables

```tsx
const { t } = useTranslation();

// In your JSON: "welcome": "Welcome, {{name}}!"
<h1>{t('welcome', { name: 'John' })}</h1>
```

### Pluralization

```tsx
// In your JSON: "items": "{{count}} item", "items_plural": "{{count}} items"
<p>{t('items', { count: 5 })}</p> // "5 items"
```

## 🎨 Language Switcher

The `LanguageSwitcher` component is already added to the Settings page. You can add it anywhere:

```tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

<LanguageSwitcher />
```

## 📝 Adding More Translations

1. **Add a new language file** in `src/i18n/locales/` (e.g., `it.json` for Italian)
2. **Update `src/i18n/config.ts`** to import and include the new language:

```typescript
import it from './locales/it.json';

const resources = {
  // ... existing languages
  it: { translation: it },
};
```

3. **Add to LanguageSwitcher** in `src/components/LanguageSwitcher.tsx`:

```typescript
const languages = [
  // ... existing languages
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];
```

## 🔧 Adding New Translation Keys

1. **Add the key to all language files** (e.g., `en.json`, `es.json`, etc.):

```json
{
  "mySection": {
    "newKey": "New Translation"
  }
}
```

2. **Use in components**:

```tsx
{t('mySection.newKey')}
```

## 📍 Where to Add Language Switcher

You can add the `LanguageSwitcher` component to:

- **Header** (for easy access)
- **Settings page** (already added)
- **Footer**
- **Navigation menu**

Example in Header:

```tsx
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// In your Header component
<div className="flex items-center gap-4">
  <LanguageSwitcher />
  {/* other header items */}
</div>
```

## 🎯 Next Steps

1. **Install the packages**: `npm install i18next react-i18next i18next-browser-languagedetector`
2. **Add translations** to all your components using `useTranslation()`
3. **Add LanguageSwitcher** to your Header or Navigation for easy access
4. **Translate your content** by updating the JSON files

## 💡 Tips

- **Start with common UI elements**: Buttons, labels, navigation
- **Use translation keys consistently**: Group related translations (e.g., `nav.*`, `common.*`)
- **Test all languages**: Make sure text fits in UI elements for all languages
- **Consider RTL languages**: Arabic, Hebrew need special handling (not included yet)

## 🐛 Troubleshooting

**Translation not showing?**
- Make sure you imported `./i18n/config` in `main.tsx`
- Check that the key exists in all language JSON files
- Verify the JSON syntax is correct

**Language not persisting?**
- Check browser localStorage (should have `i18nextLng` key)
- Clear localStorage and try again

**Component not updating on language change?**
- Make sure you're using the `t` function from `useTranslation()`
- The component will automatically re-render when language changes

