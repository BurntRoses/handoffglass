const number=new URL(location.href).searchParams.get('number');document.getElementById('number').textContent=/^\d{1,2}$/.test(number||'')?number:'';
