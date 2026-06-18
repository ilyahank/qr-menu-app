import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './LangSwitcher.css';

export default function LangSwitcher() {
  const { lang, changeLang } = useLanguage();
  return (
    <div className="lang-switcher">
      <button className={lang === 'ar' ? 'active' : ''} onClick={() => changeLang('ar')}>ع</button>
      <button className={lang === 'fr' ? 'active' : ''} onClick={() => changeLang('fr')}>FR</button>
      <button className={lang === 'en' ? 'active' : ''} onClick={() => changeLang('en')}>EN</button>
    </div>
  );
}
