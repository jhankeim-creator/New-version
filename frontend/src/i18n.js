import React, { createContext, useContext, useMemo, useState } from 'react';

const translations = {
  en: {
    nav: {
      home: 'Home',
      shopAll: 'Shop All',
      fashion: 'Fashion',
      jewelry: 'Jewelry',
      topup: 'Topup',
      trackOrder: 'Track Order',
      wishlist: 'My Wishlist',
      myAccount: 'My Account',
      myOrders: 'My Orders',
      adminDashboard: 'Admin Dashboard',
      logout: 'Logout',
      loginTitle: 'Login / Register'
    },
    common: {
      language: 'Language'
    }
  },
  fr: {
    nav: {
      home: 'Accueil',
      shopAll: 'Boutique',
      fashion: 'Mode',
      jewelry: 'Bijoux',
      topup: 'Recharge',
      trackOrder: 'Suivre une commande',
      wishlist: 'Ma liste de souhaits',
      myAccount: 'Mon compte',
      myOrders: 'Mes commandes',
      adminDashboard: 'Tableau de bord admin',
      logout: 'Déconnexion',
      loginTitle: 'Connexion / Inscription'
    },
    common: {
      language: 'Langue'
    }
  }
};

const I18nContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key
});

function getNested(obj, key) {
  return key.split('.').reduce((acc, part) => (acc && acc[part] != null ? acc[part] : null), obj);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'en');

  const setLang = (next) => {
    setLangState(next);
    localStorage.setItem('lang', next);
  };

  const value = useMemo(() => {
    const dict = translations[lang] || translations.en;
    return {
      lang,
      setLang,
      t: (key) => getNested(dict, key) ?? getNested(translations.en, key) ?? key
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

