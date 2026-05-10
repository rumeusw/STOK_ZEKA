import streamlit as st

st.set_page_config(page_title="StokZeka AI")

st.title("📈 STOK ZEKA")

st.write("Uygulama başarıyla çalışıyor!")

hisse = st.text_input("Hisse adı gir")

if st.button("Analiz Et"):
    st.success(f"{hisse} analiz edildi 🚀")
