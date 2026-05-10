node app.js
node hash.js
KLW PASS TIDAK BISA


customer
owner
courier
admin



## 1. AUTH

## REGISTER

REGISTER CUSTOMER
POST
http://localhost:3000/auth/register 
{
  "full_name": "Budi Santoso",
  "email": "budi@mail.com",
  "password": "password123",
  "role": "customer",
  "address": "Jl. Sultan Alauddin No. 5, Gowa",
  "lat": -5.20000000,
  "lng": 119.50000000
}

REGISTER COURIER
POST 
http://localhost:3000/auth/register
{
  "full_name": "Agung Prasasti",
  "email": "agung@mail.com",
  "password": "password123",
  "role": "courier",
  "vehicle_name": "Honda Beat Hitam",
  "vehicle_plate_number": "DD 1234 XY"
}


REGISTER OWNER
POST
http://localhost:3000/auth/register
{
  "full_name": "Owner Toko Laundry",
  "email": "owner@laundry.com",
  "password": "password123",
  "role": "owner",
  "address": "Jl. AP Pettarani No. 10, Makassar",
  "lat": -5.14766500,
  "lng": 119.43273200
}

## LOGIN
LOGIN ADMIN
POST 
http://localhost:3000/auth/login
{
  "email": "admin@laundry.com",
  "password": "password123"
}

LOGIN CUSTOMER
POST 
http://localhost:3000/auth/login
{
  "email": "budi@mail.com",
  "password": "password123"
}

LOGIN KURIR
POST 
http://localhost:3000/auth/login
{
  "email": "agung@mail.com",
  "password": "password123"
}

LOGIN OWNER
POST 
http://localhost:3000/auth/login
{
  "email": "owner@laundry.com",
  "password": "password123"
}


## LOGOUT
*LOGOUT
POST 
http://localhost:3000/auth/logout
TOKEN


## PROFIL

*LIHAT PROFIL USER
GET 
http://localhost:3000/auth/profile
TOKEN SEMUA ROLE


*EDIT PROFIL
PATCH 
http://localhost:3000/auth/profile
TOKEN SEMUA RULE

REQUEST REGISTER



## 2. ORDERS

BUAT PESANAN
POST
http://localhost:3000/orders
TOKEN CUSTOMER
{
  "service_id": "SVC001",
  "pickup_address": "Jl. Sultan Alauddin No. 5, Gowa",
  "pickup_lat": -5.20000000,
  "pickup_lng": 119.50000000,
  "pickup_scheduled_at": "2026-05-20 10:00:00"
}


*DETAIL LAYANAN
GET 
http://localhost:3000/services/SVC001
TOKEN SEMUA ROLE


*HAPUS LAYANAN
DELETE 
http://localhost:3000/services/SVC001
TOKEN OWNER


DETAIL ORDER
GET 
http://localhost:3000/orders/ORD1778429441792
TOKEN CUSTOMER


KONFIRMASI ORDER (OWNER)
PATCH 
http://localhost:3000/orders/ORD1778429441792/status
TOKEN OWNER
{
  "status": "confirmed"
}

Valid values: `pending | confirmed | picked_up | processing | ready | delivered`


ASSIGN COURIER (Owner tugaskan kurir)
POST 
http://localhost:3000/orders/ORD1778429441792/assign-courier 
TOKEN OWNER
{
  "courier_id": 3
}


INPUT BERAT LAUNDRY
PATCH 
http://localhost:3000/orders/ORD1778429441792/weight
TOKEN OWNER
{
  "weight_kg": 3.5
}


SWITCH KURIR KE DELIVERY
PATCH 
http://localhost:3000/orders/ORD1778429441792/courier-phase
TOKEN OWNER
> Dipanggil setelah laundry selesai diproses, sebelum diantar ke customer.

Laundry diambil
{
  "status": "picked_up"
}

Status Pertama — Berangkat Antar
{
  "status": "on_the_way"
}

Status Kedua — Sampai Customer
{
  "status": "arrived"
}

Status Ketiga — Laundry Diserahkan
{
  "status": "delivered"
}

Status Terakhir — Tugas Selesai
{
  "status": "done"
}



LIHAT PESANAN SAYA
GET 
http://localhost:3000/orders/my-orders?status=processing&page=1&limit=10
TOKEN CUSTOMER


TRACKING ORDER
GET 
http://localhost:3000/orders/ORD1778429441792/tracking
TOKEN CUSTOMER


BERI RATING
POST 
http://localhost:3000/orders/ORD1778429441792/ratings
TOKEN CUSTOMER
{
  "rating": 5,
  "review": "Laundry bersih, tepat waktu!"
}


## 3. PAYMENTS

LIHAT INVOICE
GET 
http://localhost:3000/payments/invoice/INV1778429441792
TOKEN CUSTOMER


BAYAR INVOICE
POST 
http://localhost:3000/payments
TOKEN CUSTOMER
{
  "invoice_id": "INV1778429441792",
  "payment_method": "virtual_account"
}

Valid methods: `virtual_account | transfer | cash | e_wallet`


CALLBACK PAYMENT GATEWAY
POST 
http://localhost:3000/payments/callback
TOKEN CUSTOMER
{
  "payment_id": "PAY1778433367243",
  "status": "success"
}


## 4. COURIERS

UPDATE LOKASI KURIR
PATCH 
http://localhost:3000/couriers/me/location
TOKEN COURIER
{
  "lat": -5.18500000,
  "lng": 119.46200000,
  "assignment_id": "ASG1778432564905"
}


UPDATE STATUS TUGAS
PATCH 
http://localhost:3000/couriers/tasks/ASG1778432564905/status
TOKEN COURIER

{
  "status": "done"
}

**Fase PICKUP — urutan status:**
```json
{ "status": "on_the_way" }   ← kurir berangkat ke customer
{ "status": "arrived" }      ← kurir tiba di lokasi customer
{ "status": "picked_up" }    ← laundry sudah diambil
```

**Fase DELIVERY — urutan status:**
```json
{ "status": "on_the_way" }   ← kurir berangkat antar laundry
{ "status": "arrived" }      ← kurir tiba di lokasi customer
{ "status": "delivered" }    ← laundry sudah diserahkan
{ "status": "done" }         ← selesai → order otomatis: delivered
```


TUGAS AKTIF KURIR
GET 
http://localhost:3000/couriers/me/tasks
TOKEN COURIER


RIWAYAT TUGAS KURIR
GET 
http://localhost:3000/couriers/me/tasks/history
TOKEN COURIER


## 5. SERVICES

AMBIL SEMUA LAYANAN
GET 
http://localhost:3000/services
TOKEN CUSTOMER


TAMBAH LAYANAN
POST 
http://localhost:3000/services
TOKEN OWNER
{
  "service_id": "SVC004",
  "name": "Dry Clean",
  "description": "Cuci kering untuk bahan sensitif",
  "price_per_kg": 20000
}


UPDATE LAYANAN
PATCH 
http://localhost:3000/services/SVC004
TOKEN OWNER
{
  "price_per_kg": 8000,
  "is_active": true
}


## 6. SUBSCRIPTIONS

LIHAT PAKET SUBSCRIPTION
GET 
http://localhost:3000/subscriptions/plans
TOKEN CUSTOMER


BELI PAKET SUBSCRIPTION
POST 
http://localhost:3000/subscriptions
TOKEN CUSTOMER
{
  "plan_id": "SUB001",
  "auto_renew": false
}


## 7. NOTIFICATIONS

AMBIL SEMUA NOTIFIKASI
GET 
http://localhost:3000/notifications
TOKEN SEMUA ROLE

TANDAI NOTIFIKASI DIBACA
PATCH 
http://localhost:3000/notifications/1/read
TOKEN SEMUA ROLE


## 8. ADMIN

DASHBOARD METRICS
GET 
http://localhost:3000/admin/dashboard/metrics
TOKEN ADMIN

VERIFIKASI USER
PATCH 
http://localhost:3000/admin/users/5/verify
TOKEN ADMIN
{
  "is_verified": true
}









## CONTOH PERHITUNGAN LENGKAP

**Skenario:**
- Customer: Jl. Sultan Alauddin, Gowa (`-5.2000, 119.5000`)
- Owner: Jl. AP Pettarani, Makassar (`-5.1477, 119.4327`)
- Service: SVC001 (Cuci & Setrika) = Rp 7.000/kg
- Berat: 3.5 kg

**Kalkulasi:**
```
1. Haversine (pickup → owner)    = 9.45 km
   Round-trip (× 2)              = 18.9 km

2. service_fee    = 3.5 × 7.000  = Rp 24.500
3. delivery_fee   = 18.9 × 250   = Rp  4.725
4. total_amount   = 24.500+4.725 = Rp 29.225

5. admin_commission = 24.500 × 15% = Rp  3.675
6. owner_earning    = 24.500-3.675 = Rp 20.825
7. courier_earning  = 4.725 × 80%  = Rp  3.780
```

## 🔄 ALUR LENGKAP ORDER

Customer buat order (pending)
       ↓
Owner confirm order (confirmed)
       ↓
Owner assign 1 kurir → fase: PICKUP (assigned)
       ↓
Kurir update status: on_the_way → arrived → picked_up
       ↓
Owner input berat → Backend hitung biaya → status: processing
       ↓
Invoice diupdate → Customer dapat notifikasi
       ↓
Customer bayar invoice (payment: pending → success via callback)
       ↓
Laundry selesai diproses → Owner switch kurir ke fase DELIVERY
       ↓
Kurir update status: on_the_way → arrived → delivered → done
       ↓
Order status otomatis: delivered
       ↓
Customer beri rating






## STATUS ORDER
pending    :  Pesanan baru dibuat customer, belum diproses owner
confirmed  :	Pesanan sudah diterima/dikonfirmasi owner
picked_up  :	Laundry sudah dijemput kurir
processing :  Laundry sedang dicuci/diproses
ready	     :  Laundry selesai dicuci dan siap diantar
delivered	 :  Laundry sudah diterima customer

STATUS TUGAS KURIR
assigned	 :  Kurir baru ditugaskan
on_the_way :  Kurir sedang menuju lokasi
arrived	   :  Kurir sudah sampai
picked_up	 :  Laundry sudah diambil
delivered	 :  Laundry sudah dikirim
done	     :  Tugas selesai

STATUS PAYMENT
pending	   :  Menunggu pembayaran
success	   :  Pembayaran berhasil
failed	   :  Pembayaran gagal

STATUS INVOICE
unpaid	   :  Belum dibayar
paid	     :  Sudah dibayar

STATUS SUBSCRIPTION
active     :  Langganan aktif

STATUS VERIFIKASI USER
0	         :  Belum diverifikasi
1	         :  Sudah diverifikasi

STATUS NOTIFIKASI
0	         :  Belum dibaca
1	         :  Sudah dibaca

TASK TYPE KURIR
pickup      :  ambil laundry
delivery    :  antar laundry kembali