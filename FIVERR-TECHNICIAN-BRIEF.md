# ENFÒMASYON POU TEKNISYEN FIVERR - DEPLWAMAN KAYEE01

## 📋 REZIME PWOJÈ A

**Non Aplikasyon:** Kayee01 E-commerce
**Domèn:** kayee01.com
**Tip Sit:** E-commerce pou pwodui fashion/jewelry (1:1 Replica)

---

## 🖥️ ENFÒMASYON SÈVÈ VPS

**Provider:** Hostinger VPS
**IP:** 93.127.217.2
**OS:** Ubuntu (latest)
**Aksè:** SSH via Termius
**DNS:** kayee01.com deja poente vè 93.127.217.2 ✅

**Kòmand Koneksyon:**
```
ssh root@93.127.217.2
```

---

## 🛠️ STACK TEKNIK

**Backend:**
- FastAPI (Python 3.11)
- MongoDB (pwodui, lòd, itilizatè)
- JWT pou otantifikasyon

**Frontend:**
- React (Node 20)
- Tailwind CSS
- Yarn (PA npm)

**Infrastructure:**
- Docker + Docker Compose
- Nginx (reverse proxy)
- Certbot (pou SSL/HTTPS)

---

## 📁 FICHYE DEPLWAMAN

**Repo GitHub:** https://github.com/jhankeim-creator/Kayee-beta
**Branch:** main
**Dosye Deplwaman:** VPS-FINAL-COMPLETE/

**Fichye Enpòtan:**
- `DEPLOY.sh` - Script otomatik pou tout enstale
- `docker-compose.yml` - Konfigirasyon Docker
- `Dockerfile.backend` + `Dockerfile.frontend`
- `nginx.conf` - Konfigirasyon Nginx
- `setup-ssl.sh` - Konfigirasyon SSL
- `.env.template` - Template pou environment variables

---

## 🔑 CREDENTIALS AK KLE API

**MongoDB:**
- Username: admin
- Password: Kk11221122..

**Email (SMTP Gmail):**
- User: kayicom509@gmail.com
- Password: remxlraghtscsvgo
- SMTP Host: smtp.gmail.com
- SMTP Port: 587

**Stripe (Peman):**
- Secret Key: [Mwen pral ba ou li]
- Mode: Production (live)

**Plisio (Crypto Peman):**
- API Key: wbCcAllVFcUfRqrB-hV4OebIbPy31KXYEvzjX6NEA19N6abD60LikJqnq_nt1hQx

**Admin Emails:**
- Email 1: kayicom509@gmail.com
- Email 2: Info.kayicom.com@gmx.fr

---

## 📝 ETAP DEPLWAMAN

### 1. NETWAYE VPS LA (si gen bagay deja)
```bash
cd /opt/kayee01 2>/dev/null && docker-compose down -v 2>/dev/null
docker stop $(docker ps -aq) 2>/dev/null
docker rm $(docker ps -aq) 2>/dev/null
docker system prune -af --volumes
cd / && sudo rm -rf /opt/kayee01
```

### 2. DOWNLOAD REPO
```bash
cd /opt
mkdir kayee01 && cd kayee01
wget https://github.com/jhankeim-creator/Kayee-beta/archive/refs/heads/main.zip
unzip main.zip
mv Kayee-beta-main/* .
rm -rf Kayee-beta-main main.zip
```

### 3. KONFIGURE .env
```bash
cd VPS-FINAL-COMPLETE
cp .env.template .env
nano .env
```

**Change sa yo:**
- MONGO_PASSWORD=Kk11221122..
- SMTP_USER=kayicom509@gmail.com
- SMTP_PASSWORD=remxlraghtscsvgo
- STRIPE_SECRET_KEY=[kle reyèl la]
- PLISIO_API_KEY=wbCcAllVFcUfRqrB-hV4OebIbPy31KXYEvzjX6NEA19N6abD60LlikJqnq_nt1hQx

### 4. DEPLOY
```bash
chmod +x DEPLOY.sh
sudo ./DEPLOY.sh
```

### 5. KONFIGURE SSL
```bash
chmod +x setup-ssl.sh
sudo ./setup-ssl.sh kayee01.com
```

---

## ⚠️ PWOBLÈM KONNEN (POU EVITE YO)

1. **Healthchecks:** Pa itilize healthchecks nan docker-compose, yo koze restart containers
2. **Node Version:** DÒLMAN itilize Node 20 (pa 18)
3. **Context Path:** Nan docker-compose, context dwe `..` (pa `.`)
4. **Nginx Upstream:** Itilize upstream blocks, pa variables dinamik
5. **MongoDB Password:** Pa itilize karaktè espesyal (#, @, !)

---

## ✅ KRITÈ SIKSÈ

**Sit la dwe:**
1. ✅ Aksesib sou http://93.127.217.2
2. ✅ Aksesib sou https://kayee01.com (ak SSL)
3. ✅ Backend API ap travay (/api/products)
4. ✅ Frontend ap chaje
5. ✅ Pa gen containers ap redémarre
6. ✅ MongoDB konekte e ap travay

**Pou teste:**
```bash
docker-compose ps  # Tout containers dwe "Up"
curl -I http://localhost  # Dwe bay HTTP 200 OK
curl https://kayee01.com/api/products  # Dwe bay lis pwodui
```

---

## 📞 KESYON TEKNISYEN KA POZE

**1. "Ki aksè VPS ou genyen?"**
→ SSH: root@93.127.217.2

**2. "Èske domèn lan konfigure?"**
→ Wi, kayee01.com deja poente vè IP a

**3. "Ki tech stack la?"**
→ FastAPI + React + MongoDB + Docker + Nginx

**4. "Èske ou gen kle API yo?"**
→ Wi, tout kle yo nan dokiman sa a

**5. "Ki pwoblèm ou te rankontre?"**
→ Containers te ap redémarre akòz healthchecks

**6. "Èske gen backup?"**
→ Pa gen backup data, se nouvo deployment

**7. "Ki port ki dwe ouvè?"**
→ 80 (HTTP), 443 (HTTPS), 22 (SSH)

**8. "Èske ou vle monitoring?"**
→ Wi, gen script monitor.sh nan repo a

---

## 💰 ENFÒMASYON ADISYONÈL

**Tan Estime:** 2-4 èdtan
**Deliverables Atann:**
- Sit fonksyonèl sou https://kayee01.com
- SSL/HTTPS konfigure
- Tout sèvis Docker ap travay
- Dokimantasyon rapid sou ki jan pou redémarre sèvis yo

**Apre Deplwaman:**
- Voye m lyen sit la: https://kayee01.com
- Voye m screenshot `docker-compose ps`
- Voye m screenshot sit la ap mache

---

## 📧 KONTAK

Si teknisyen an gen kesyon, li ka kontakte m via:
- Fiverr Messages
- Email: kayicom509@gmail.com

---

**Dènye Mizajou:** 26 Oktòb 2024
**Status:** Prè pou deplwaman
