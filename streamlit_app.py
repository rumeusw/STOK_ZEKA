import streamlit as st
import sqlite3
import pandas as pd
import os
from datetime import datetime

# Sayfa Ayarları
st.set_page_config(page_title="StokZeka AI - Dashboard", layout="wide", page_icon="📈")

# Veritabanı Bağlantısı
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = os.path.join(BASE_DIR, "en son database.db")

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        st.error(f"Veritabanı bağlantı hatası: {e}")
        return None

# --- CSS ile Güzelleştirme ---
st.markdown("""
    <style>
    .main {
        background-color: #f5f7f9;
    }
    .stMetric {
        background-color: #ffffff;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    </style>
    """, unsafe_allow_html=True)

st.title("📈 StokZeka AI")
st.subheader("Akıllı Stok ve Finans Yönetimi")

# --- Kenar Çubuğu Navigasyonu ---
menu = st.sidebar.selectbox("Menü", ["📊 Genel Bakış", "🛒 Satış Kaydı", "📦 Stok Girişi", "🤖 AI Analiz", "💰 Finansal Durum"])

if menu == "📊 Genel Bakış":
    st.header("Mevcut Stok Durumu")
    
    conn = get_db_connection()
    query = """
    SELECT 
        u.Urun_ID as 'ID', 
        u.Urun_Adi as 'Ürün Adı', 
        COALESCE(SUM(sh.Miktar), 0) as 'Mevcut Stok', 
        u.Kritik_Stok as 'Kritik Eşik',
        t.Tedarikci_Adi as 'Tedarikçi'
    FROM Urunler u
    LEFT JOIN Stok_Hareketleri sh ON u.Urun_ID = sh.Urun_ID
    LEFT JOIN Urun_Tedarik ut ON u.Urun_ID = ut.Urun_ID
    LEFT JOIN Tedarikciler t ON ut.Tedarikci_ID = t.Tedarikci_ID
    GROUP BY u.Urun_ID
    """
    df = pd.read_sql_query(query, conn)
    conn.close()

    # Durum Belirleme
    def determine_status(row):
        if row['Mevcut Stok'] <= row['Kritik Eşik']:
            return 'Kritik 🔴'
        elif row['Mevcut Stok'] <= row['Kritik Eşik'] * 1.5:
            return 'Düşük 🟡'
        return 'Yeterli 🟢'

    df['Durum'] = df.apply(determine_status, axis=1)
    
    # Metrikler
    col1, col2, col3 = st.columns(3)
    col1.metric("Toplam Ürün", len(df))
    col2.metric("Kritik Seviyede", len(df[df['Durum'] == 'Kritik 🔴']))
    col3.metric("Düşük Stok", len(df[df['Durum'] == 'Düşük 🟡']))

    st.dataframe(df, use_container_width=True)

elif menu == "🛒 Satış Kaydı":
    st.header("Yeni Satış Kaydet")
    
    conn = get_db_connection()
    urunler = pd.read_sql_query("SELECT Urun_ID, Urun_Adi FROM Urunler", conn)
    conn.close()

    with st.form("satis_formu"):
        urun = st.selectbox("Ürün Seçin", urunler['Urun_Adi'].tolist())
        adet = st.number_input("Adet", min_value=1, value=1)
        fiyat = st.number_input("Birim Fiyat (TL)", min_value=0.0, value=50.0)
        tarih = st.date_input("Tarih", datetime.now())
        submit = st.form_submit_button("Satışı Kaydet")

        if submit:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                urun_id = urunler[urunler['Urun_Adi'] == urun]['Urun_ID'].values[0]
                toplam = adet * fiyat
                
                # Satışlar tablosuna ekle
                cursor.execute(
                    "INSERT INTO Satislar (Tarih, Urun_ID, Adet, Birim_Fiyat_TL, Toplam_Satis_TL) VALUES (?, ?, ?, ?, ?)",
                    (tarih.strftime('%Y-%m-%d'), urun_id, adet, fiyat, toplam)
                )
                # Stok hareketlerine ekle
                cursor.execute(
                    "INSERT INTO Stok_Hareketleri (Tarih, Urun_ID, Miktar, Islem_Tipi) VALUES (?, ?, ?, ?)",
                    (tarih.strftime('%Y-%m-%d'), urun_id, -adet, 'Satis')
                )
                conn.commit()
                conn.close()
                st.success(f"Satış başarıyla kaydedildi! Toplam: {toplam} TL")
            except Exception as e:
                st.error(f"Hata oluştu: {e}")

elif menu == "📦 Stok Girişi":
    st.header("Stok Girişi Yap")
    
    conn = get_db_connection()
    urunler = pd.read_sql_query("SELECT Urun_ID, Urun_Adi FROM Urunler", conn)
    conn.close()

    with st.form("stok_formu"):
        urun = st.selectbox("Ürün Seçin", urunler['Urun_Adi'].tolist())
        miktar = st.number_input("Miktar", min_value=1, value=10)
        tarih = st.date_input("Tarih", datetime.now())
        submit = st.form_submit_button("Stok Girişini Kaydet")

        if submit:
            try:
                conn = get_db_connection()
                cursor = conn.cursor()
                urun_id = urunler[urunler['Urun_Adi'] == urun]['Urun_ID'].values[0]
                
                cursor.execute(
                    "INSERT INTO Stok_Hareketleri (Tarih, Urun_ID, Miktar, Islem_Tipi) VALUES (?, ?, ?, ?)",
                    (tarih.strftime('%Y-%m-%d'), urun_id, miktar, 'Giris')
                )
                conn.commit()
                conn.close()
                st.success(f"{miktar} adet {urun} stoğa eklendi!")
            except Exception as e:
                st.error(f"Hata oluştu: {e}")

elif menu == "🤖 AI Analiz":
    st.header("🤖 Yapay Zeka Stok Analizi")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.Urun_Adi, COALESCE(SUM(sh.Miktar), 0) as stok, u.Kritik_Stok
        FROM Urunler u
        LEFT JOIN Stok_Hareketleri sh ON u.Urun_ID = sh.Urun_ID
        GROUP BY u.Urun_ID
        HAVING stok <= u.Kritik_Stok
    """)
    kritikler = cursor.fetchall()
    conn.close()

    if kritikler:
        st.warning(f"AI Uyarısı: {len(kritikler)} ürün kritik seviyede!")
        for k in kritikler:
            st.info(f"**{k['Urun_Adi']}** stoğu {k['stok']} birime düşmüş. Acil 50 adet sipariş öneriliyor.")
    else:
        st.success("AI Analizi: Stok seviyeleriniz şu an dengeli görünüyor.")

    st.subheader("Öngörülen Aylık Tedarik")
    st.table([
        {"Malzeme": "Süt", "Miktar": "400 L", "Önem": "Yüksek"},
        {"Malzeme": "Kahve Çekirdeği", "Miktar": "45 kg", "Önem": "Kritik"}
    ])

elif menu == "💰 Finansal Durum":
    st.header("Finansal Analiz Özet")
    
    conn = get_db_connection()
    # Toplam Ciro
    ciro_df = pd.read_sql_query("SELECT SUM(Toplam_Satis_TL) as ciro FROM Satislar", conn)
    toplam_ciro = ciro_df['ciro'].iloc[0] or 0
    
    # Basit Kar Hesabı (Satislar %35 maliyet varsayımı - server.py'daki gibi)
    maliyet = toplam_ciro * 0.35
    kar = toplam_ciro - maliyet
    
    col1, col2, col3 = st.columns(3)
    col1.metric("Toplam Ciro", f"{toplam_ciro:,.2f} TL")
    col2.metric("Tahmini Maliyet", f"{maliyet:,.2f} TL", delta_color="inverse")
    col3.metric("Net Kar", f"{kar:,.2f} TL")

    # Satış Grafiği
    st.subheader("Günlük Satış Trendi")
    satis_trend = pd.read_sql_query("SELECT Tarih, SUM(Toplam_Satis_TL) as Gunluk_Ciro FROM Satislar GROUP BY Tarih", conn)
    if not satis_trend.empty:
        st.line_chart(satis_trend.set_index('Tarih'))
    
    conn.close()
