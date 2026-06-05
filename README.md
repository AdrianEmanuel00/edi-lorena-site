# Edi & Lorena - Invitatie de nunta

Website tip invitatie de nunta cu RSVP si panou admin.

## Varianta live pe cPanel

Proiectul este pregatit pentru hosting clasic cPanel, fara Node.js, folosind PHP + MySQL.

### 1. Creeaza baza de date

In cPanel:

1. Intra la `MySQL Databases`.
2. Creeaza o baza de date, de exemplu `username_edi_lorena`.
3. Creeaza un user MySQL.
4. Adauga userul la baza de date cu drepturi `ALL PRIVILEGES`.

Tabela `rsvps` se creeaza automat la primul request API. Optional, o poti crea manual din `database.sql`.

### 2. Configureaza API-ul

Copiaza:

```text
public/api/config.example.php
```

ca:

```text
public/api/config.php
```

si completeaza datele reale:

```php
return [
    'db_host' => 'localhost',
    'db_name' => 'username_edi_lorena',
    'db_user' => 'username_edi_lorena',
    'db_password' => 'parola_bazei_de_date',
    'admin_user' => 'admin',
    'admin_password' => 'lagoo2026',
    'session_name' => 'edi_lorena_admin',
];
```

`public/api/config.php` este ignorat de Git, ca sa nu publici parola bazei de date.

### 3. Urca site-ul pe subdomeniu

Pentru subdomeniul:

```text
eduard-si-lorena.aerdigital.ro
```

document root-ul trebuie sa contina fisierele din folderul `public`.

Exemplu structura live:

```text
index.html
admin.html
styles.css
app.js
admin.js
.htaccess
assets/
api/
```

### 4. Admin

URL:

```text
https://eduard-si-lorena.aerdigital.ro/admin
```

Date implicite:

```text
username: admin
parola: lagoo2026
```

## Update-uri prin Git

Flux recomandat:

1. Codul sta pe GitHub.
2. In cPanel folosesti `Git Repo` / `Git Version Control`.
3. La update faci `git push`, apoi `Pull` / `Deploy` in cPanel.

Datele RSVP nu se pierd la update, pentru ca sunt in MySQL.

Pentru deploy automat prin cPanel, poti porni de la:

```text
cpanel-deploy.example.yml
```

Il copiezi ca `.cpanel.yml` doar dupa ce stii calea reala a subdomeniului, de forma:

```text
/home/USERNAME/public_html/eduard-si-lorena/
```

## Pornire locala veche cu Node

Pentru preview local rapid poti folosi in continuare serverul Node:

```powershell
npm start
```

Local:

```text
http://localhost:3000
http://localhost:3000/admin
```

In modul local Node, raspunsurile se salveaza in `data/rsvps.json`. In productie cPanel, raspunsurile se salveaza in MySQL.
