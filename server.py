from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from datetime import datetime

app = FastAPI()

# CORS Ayarları (Frontend'in sunucuya erişebilmesi için)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- VERİ MODELLERİ ---
class Satis(BaseModel):
    tarih: str
    urun_id: str
    adet: int
    birim_fiyat: float

class StokHareketi(BaseModel):
    tarih: str
    urun_id: str
    miktar: int
    islem_tipi: str

# --- GEÇİCİ VERİ TABANI (RAM ÜZERİNDE) ---
# Gerçek projede burada SQL veritabanı kullanılır.
stok_verisi = [
    {"urun_id":"P001","urun_adi":"Çay","mevcut_stok":28,"kritik_esik":50,"durum":"Kritik","Tedarikci_Adi":"Kahve Pazarı","Tedarik_Suresi_Gun":3},
    {"urun_id":"P002","urun_adi":"Türk Kahvesi","mevcut_stok":65,"kritik_esik":30,"durum":"Yeterli","Tedarikci_Adi":"Kahve Pazarı","Tedarik_Suresi_Gun":1},
    {"urun_id":"P003","urun_adi":"Latte","mevcut_stok":18,"kritik_esik":25,"durum":"Kritik","Tedarikci_Adi":"Kahve Pazarı","Tedarik_Suresi_Gun":1},
]

satislar = []

# --- ENDPOINTLER ---

@app.get("/")
def home():
    return {"mesaj": "StokZeka AI Backend Çalışıyor"}

@app.get("/stok/mevcut")
def get_stok():
    # Durumları hesapla
    for urun in stok_verisi:
        if urun["mevcut_stok"] <= urun["kritik_esik"]:
            urun["durum"] = "Kritik"
        elif urun["mevcut_stok"] <= urun["kritik_esik"] * 1.5:
            urun["durum"] = "Düşük"
        else:
            urun["durum"] = "Yeterli"
            
    ozet = {
        "toplam": len(stok_verisi),
        "kritik": len([u for u in stok_verisi if u["durum"] == "Kritik"]),
        "dusuk": len([u for u in stok_verisi if u["durum"] == "Düşük"]),
        "yeterli": len([u for u in stok_verisi if u["durum"] == "Yeterli"])
    }
    return {"urunler": stok_verisi, "ozet": ozet}

@app.get("/urunler")
def get_urunler():
    return {"urunler": stok_verisi}

@app.post("/satislar/kaydet")
def kaydet_satis(satis: Satis):
    satislar.append(satis.dict())
    # Stoktan düş
    for urun in stok_verisi:
        if urun["urun_id"] == satis.urun_id:
            urun["mevcut_stok"] -= satis.adet
            break
    return {"durum": "basarili", "toplam_tutar_tl": satis.adet * satis.birim_fiyat}

@app.post("/stok/giris")
def kaydet_stok(hareket: StokHareketi):
    # Stok ekle veya çıkar
    for urun in stok_verisi:
        if urun["urun_id"] == hareket.urun_id:
            if hareket.islem_tipi == "Giris":
                urun["mevcut_stok"] += hareket.miktar
            else:
                urun["mevcut_stok"] -= hareket.miktar
            break
    return {"durum": "basarili"}

@app.get("/ai/analiz")
def ai_analiz():
    # Demo AI yanıtı
    return {
        "ozet": "Satış verileri Americano talebinde %15 artış gösteriyor. Çay stokları kritik seviyenin altında, acil tedarik önerilir.",
        "acil_siparisler": [
            {"urun": "Çay", "miktar": 100, "neden": "Kritik stok seviyesi"},
            {"urun": "Latte", "miktar": 50, "neden": "Hızlı tüketim trendi"}
        ],
        "aylik_tedarik": [
            {"malzeme": "Süt", "miktar": 400, "birim": "L"},
            {"malzeme": "Kahve Çekirdeği", "miktar": 45, "birim": "kg"}
        ]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
