# 🧪 GUIDE DE TEST COMPLET - LuxeBoutique E-Commerce

## 🌐 URL du site
**Site web:** https://luxury-shop-11.preview.emergentagent.com

---

## ✅ TEST 1: Navigation et Interface

### Étapes:
1. Ouvrez le site dans votre navigateur
2. Vérifiez que le site charge correctement
3. Testez la navigation :
   - Cliquez sur "Shop All"
   - Cliquez sur "Fashion"
   - Cliquez sur "Jewelry"
   - Cliquez sur "Track Order"

### ✓ Résultat attendu:
- Toutes les pages se chargent rapidement
- Le design est professionnel
- Les images s'affichent correctement
- La navigation fonctionne sans erreur

---

## ✅ TEST 2: Catalogue Produits

### Étapes:
1. Allez sur "Shop All"
2. Vérifiez la pagination en bas de page
3. Cliquez sur "Page 2"
4. Testez les filtres par catégorie (Fashion/Jewelry)

### ✓ Résultat attendu:
- **1500 produits** disponibles
- **Pagination** : 75 pages (20 produits/page)
- **Affichage** : 2 colonnes responsive
- **Filtres** fonctionnels

---

## ✅ TEST 3: Détails Produit et Panier

### Étapes:
1. Cliquez sur n'importe quel produit
2. Regardez les détails du produit
3. Changez la quantité (+ et -)
4. Cliquez sur "Add to Cart"
5. Vérifiez que le compteur du panier augmente (en haut à droite)
6. Cliquez sur l'icône panier

### ✓ Résultat attendu:
- Page produit affiche : nom, prix, description, stock, images
- Quantité modifiable
- Message "Added to cart" apparaît
- Badge avec nombre d'articles sur l'icône panier
- Page panier affiche tous les produits ajoutés

---

## ✅ TEST 4: Processus de Commande

### Étapes:
1. Dans le panier, cliquez sur "Proceed to Checkout"
2. Remplissez le formulaire :
   ```
   Nom: Jean Dupont
   Email: test@exemple.com
   Téléphone: +33612345678
   Adresse: 123 Rue de Paris
   Ville: Paris
   Code Postal: 75001
   Pays: France
   ```
3. Scrollez vers les méthodes de paiement
4. Sélectionnez **"Plisio"**
5. Cliquez sur "Place Order"

### ✓ Résultat attendu:
- Formulaire valide les champs requis
- 6 méthodes de paiement affichées :
  - Carte Bancaire (Stripe)
  - PayPal
  - CoinPal.io
  - Binance Pay
  - **Plisio** ← Sélectionnez celle-ci
  - Paiement Manuel
- Bouton "Place Order" actif

---

## ✅ TEST 5: Paiement Plisio (RÉEL)

### Étapes:
1. Après avoir cliqué "Place Order"
2. Attendez 2-3 secondes
3. Page de confirmation se charge
4. Scrollez vers le bas
5. Vous devriez voir :
   - ✅ Numéro de commande (ex: ORD-ABCD1234)
   - ✅ Bouton "Payer avec Plisio" (vert)
   - ✅ QR code pour paiement crypto
6. Cliquez sur "Payer avec Plisio"

### ✓ Résultat attendu:
- Redirection vers **page Plisio réelle**: https://plisio.net/invoice/xxxxx
- Page Plisio affiche :
  - 💰 Montant en BTC (converti automatiquement)
  - 🪙 Liste de 100+ cryptos acceptées
  - ⏱️ Timer de paiement (30 minutes)
  - 📱 QR code scannable
  - 📋 Adresse wallet à copier

### 🎯 À CE STADE - PLISIO EST ACTIF !

---

## ✅ TEST 6: Admin Dashboard

### Étapes:
1. Allez sur : https://luxury-shop-11.preview.emergentagent.com/admin
2. Connectez-vous :
   ```
   Email: admin@luxeboutique.com
   Password: admin123
   ```
3. Vérifiez le tableau de bord
4. Cliquez sur l'onglet "Orders"
5. Trouvez votre commande de test
6. Changez le statut à "Processing"

### ✓ Résultat attendu:
- Dashboard affiche :
  - Total Products: 1500
  - Total Orders: X
  - Total Users: X
  - Total Revenue: $X
- Onglets : Products, Orders, Categories
- Votre commande de test apparaît
- Possibilité de changer le statut

---

## ✅ TEST 7: Suivre une Commande

### Étapes:
1. Cliquez sur "Track Order" dans le menu
2. Entrez votre numéro de commande (ex: ORD-ABCD1234)
3. Cliquez sur "Track"

### ✓ Résultat attendu:
- Détails de la commande affichés
- Statut actuel visible
- Barre de progression :
  - Pending
  - Processing
  - Shipped
  - Delivered
- Informations de livraison
- Liste des articles

---

## ✅ TEST 8: Authentification Sociale (Mode Démo)

### Étapes:
1. Allez sur : https://luxury-shop-11.preview.emergentagent.com/admin/login
2. Scrollez vers le bas
3. Vous verrez les boutons :
   - "Google"
   - "Facebook"
4. Cliquez sur "Google"

### ✓ Résultat attendu:
- Message "Mode démo - Connexion Google simulée"
- En production, redirigerait vers Google OAuth

---

## ✅ TEST 9: Emails Automatiques (Logs)

### Étapes Backend (SSH requis):
```bash
# Voir les emails envoyés en mode démo
tail -f /var/log/supervisor/backend.out.log | grep "EMAIL"
```

### ✓ Résultat attendu:
Vous verrez les logs des emails qui auraient été envoyés :
- 📧 Email de confirmation de commande
- 📧 Email de paiement confirmé (si statut changé)
- 📧 Email de mise à jour de statut

---

## ✅ TEST 10: API Endpoints

### Tester l'API Plisio:
```bash
curl -X POST "https://luxury-shop-11.preview.emergentagent.com/api/payments/plisio/create" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "TEST-API-001",
    "amount": 25.00,
    "currency": "USD",
    "description": "Test API",
    "customer_email": "test@api.com"
  }'
```

### ✓ Résultat attendu:
```json
{
  "success": true,
  "invoice_id": "68f1xxxxx",
  "invoice_url": "https://plisio.net/invoice/68f1xxxxx",
  "source_amount": 25.00,
  "source_currency": "USD"
}
```

---

## 🎯 CHECKLIST COMPLÈTE

- [ ] Site charge correctement
- [ ] 1500 produits affichés avec pagination
- [ ] Ajout au panier fonctionne
- [ ] Checkout form validation OK
- [ ] **Plisio génère une vraie facture** ✅
- [ ] Page de confirmation affiche le lien Plisio
- [ ] Admin dashboard accessible
- [ ] Commandes visibles dans admin
- [ ] Track order fonctionne
- [ ] Boutons OAuth affichés
- [ ] Emails loggés dans console
- [ ] API endpoints répondent

---

## 🐛 DÉPANNAGE

### Problème: Plisio ne crée pas de facture réelle
**Solution:**
```bash
# Vérifier que la clé est bien chargée
grep PLISIO_API_KEY /app/backend/.env

# Redémarrer le backend
sudo supervisorctl restart backend

# Vérifier les logs
tail -f /var/log/supervisor/backend.err.log
```

### Problème: Page ne charge pas
**Solution:**
```bash
# Vérifier tous les services
sudo supervisorctl status

# Redémarrer tout
sudo supervisorctl restart all
```

### Problème: Erreur au checkout
**Solution:**
```bash
# Vérifier les logs backend
tail -100 /var/log/supervisor/backend.err.log

# Vérifier les logs frontend
tail -100 /var/log/supervisor/frontend.err.log
```

---

## 📊 RÉSULTATS ATTENDUS

### ✅ FONCTIONNEL
- Navigation fluide
- 1500 produits avec pagination
- Panier et checkout
- **Paiement Plisio RÉEL** ✅
- Admin dashboard complet
- Suivi de commande
- Emails automatiques (mode démo)

### 🎭 MODE DÉMO (nécessite clés API)
- Stripe
- PayPal
- CoinPal
- Binance Pay
- Google/Facebook OAuth
- Envoi réel d'emails

---

## 🚀 PROCHAINES ÉTAPES

1. **Tester Plisio en réel** (ACTIF ✅)
2. Ajouter clés Stripe pour cartes bancaires
3. Ajouter clés PayPal
4. Configurer webhooks
5. Configurer SMTP pour vrais emails
6. Tester avec vraies transactions

---

## 📞 SUPPORT

**Documentation:**
- `/app/INTEGRATION_GUIDE.md` - Guide intégration complet
- `/app/API_ENDPOINTS.md` - Tous les endpoints API
- `/app/STORE_INSTRUCTIONS.md` - Instructions boutique

**Logs:**
```bash
# Backend
tail -f /var/log/supervisor/backend.err.log

# Frontend  
tail -f /var/log/supervisor/frontend.err.log

# Tous les services
sudo supervisorctl status
```

---

**🎉 Votre boutique e-commerce est prête pour les tests !**

**Plisio fonctionne avec de vraies factures crypto ! 🪙**
