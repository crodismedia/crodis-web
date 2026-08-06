(function(){
  'use strict';
  const $=(id)=>document.getElementById(id);
  const supabase=window.supabaseClient;
  const params=new URLSearchParams(location.search);
  const tallerId=params.get('id')||'';
  const tallerSlug=params.get('slug')||'';
  let taller=null;

  function estado(texto,ok=false){$('estado-reclamacion').textContent=texto;$('estado-reclamacion').style.color=ok?'#166534':'#7c2d12';}
  function limpiar(v){return String(v||'').trim();}
  function telefonoValido(v){return /^(?:\+34\s?)?[6789](?:[\s.-]?\d){8}$/.test(limpiar(v));}

  async function cargarTaller(){
    if(!supabase){$('taller-resumen').textContent='No se pudo iniciar la conexión segura.';return;}
    let consulta=supabase.from('talleres').select('id,nombre,direccion,codigo_postal,ciudad,provincia,slug').limit(1);
    if(tallerId) consulta=consulta.eq('id',tallerId);
    else if(tallerSlug) consulta=consulta.eq('slug',tallerSlug);
    else { $('taller-resumen').textContent='No se ha identificado ninguna ficha. Vuelve al taller y pulsa el botón de gestión.'; $('form-reclamacion').classList.add('hidden'); return; }
    const {data,error}=await consulta.maybeSingle();
    if(error||!data){$('taller-resumen').textContent='No se ha podido localizar la ficha seleccionada.';$('form-reclamacion').classList.add('hidden');return;}
    taller=data;$('taller-id').value=data.id;$('taller-slug').value=data.slug||tallerSlug;
    $('taller-resumen').innerHTML=`<strong>${String(data.nombre||'Taller sin nombre').replace(/[<>]/g,'')}</strong><br>${[data.direccion,data.codigo_postal,data.ciudad,data.provincia].filter(Boolean).map(x=>String(x).replace(/[<>]/g,'')).join(' · ')}`;
  }

  async function enviar(e){
    e.preventDefault();
    if(!taller){estado('No hay una ficha válida seleccionada.');return;}
    const nombre=limpiar($('nombre-responsable').value);
    const cargo=$('cargo').value;
    const email=limpiar($('email-contacto').value).toLowerCase();
    const telefono=limpiar($('telefono-contacto').value);
    const metodo=$('metodo-verificacion').value;
    if(nombre.length<5){estado('Escribe el nombre completo del responsable.');return;}
    if(!telefonoValido(telefono)){estado('Introduce un teléfono español válido.');return;}

    const {data:{session}}=await supabase.auth.getSession();
    if(!session){
      sessionStorage.setItem('tallermap_reclamacion_pendiente',location.href);
      estado('Para continuar debes iniciar sesión o crear una cuenta. Después volverás a esta solicitud.');
      setTimeout(()=>{location.href='registro.html?modo=propietario';},900);
      return;
    }

    const payload={
      taller_id:taller.id,
      solicitante_user_id:session.user.id,
      nombre_responsable:nombre,
      relacion_taller:cargo,
      email_contacto:email,
      telefono_contacto:telefono,
      metodo_verificacion:metodo,
      estado:'pendiente',
      declaracion_veracidad:true
    };
    const boton=e.submitter; if(boton) boton.disabled=true;
    estado('Registrando solicitud segura…');
    const {error}=await supabase.from('solicitudes_propiedad_taller').insert(payload);
    if(boton) boton.disabled=false;
    if(error){
      if(error.code==='42P01') estado('El formulario está preparado, pero falta activar la tabla de solicitudes en Supabase.');
      else if(error.code==='23505') estado('Ya existe una solicitud pendiente para esta ficha y esta cuenta.');
      else estado(`No se pudo registrar la solicitud: ${error.message}`);
      return;
    }
    document.querySelectorAll('.step').forEach((s,i)=>s.classList.toggle('active',i<=1));
    $('form-reclamacion').classList.add('hidden');
    estado('Solicitud registrada. El siguiente paso será verificar tu relación con el taller. Hasta entonces no podrás editar ni darlo de baja.',true);
  }

  $('form-reclamacion').addEventListener('submit',enviar);
  cargarTaller();
}());
