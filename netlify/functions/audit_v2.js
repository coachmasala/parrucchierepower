exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  let nome, cognome, email, telefono, salone;
  try {
    const body = JSON.parse(event.body);
    nome     = (body.nome     || '').trim();
    cognome  = (body.cognome  || '').trim();
    email    = (body.email    || '').trim().toLowerCase();
    telefono = (body.telefono || '').trim().replace(/\s+/g, ''); // Rimuovo spazi
    salone   = (body.salone   || '').trim();
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Dati non validi' }) };
  }

  if (!nome || !email || !cognome || !telefono || !salone) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Tutti i campi sono obbligatori' }) };
  }

  // Pulizia e formattazione numero di telefono per Brevo (SMS richiede prefisso internazionale)
  let formattedPhone = telefono;
  if (formattedPhone.startsWith('3') && formattedPhone.length >= 9 && formattedPhone.length <= 10) {
    formattedPhone = '+39' + formattedPhone;
  } else if (formattedPhone.startsWith('0') && !formattedPhone.startsWith('00')) {
    formattedPhone = '+39' + formattedPhone;
  }

  const BREVO_KEY = process.env.BREVO_API_KEY_LANDING;
  if (!BREVO_KEY) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Configurazione server mancante (BREVO_API_KEY_LANDING non trovata su Netlify)' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'api-key': BREVO_KEY
  };

  // 1. Tentativo aggiunta contatto a Brevo (Lista 6)
  try {
    const contactPayload = {
      email,
      attributes: { 
        NOME: nome, 
        COGNOME: cognome, 
        SMS: formattedPhone, 
        JOB_TITLE: salone 
      },
      listIds: [6],
      updateEnabled: true
    };

    let contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers,
      body: JSON.stringify(contactPayload)
    });
    
    if (!contactRes.ok) {
      const errData = await contactRes.json();
      
      // Se l'errore è il numero di telefono (invalid_parameter), riproviamo senza il campo SMS
      if (errData.code === 'invalid_parameter' && errData.message.toLowerCase().includes('phone')) {
        console.warn('Brevo rejected phone number, retrying without SMS attribute...');
        delete contactPayload.attributes.SMS;
        contactRes = await fetch('https://api.brevo.com/v3/contacts', {
          method: 'POST',
          headers,
          body: JSON.stringify(contactPayload)
        });
      }

      if (!contactRes.ok) {
        const finalErr = await contactRes.json();
        if (contactRes.status !== 400 || !finalErr.message.includes('already exists')) {
          console.error('Brevo contact final error:', finalErr);
          return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Brevo contact error: ' + (finalErr.message || 'Errore sconosciuto') }) };
        }
      }
    }
  } catch(e) {
    console.error('Brevo contact fetch error:', e);
    // Proseguiamo comunque per inviare almeno la notifica via email
  }

  // 2. Invio email di notifica a Coach Masala (QUESTA DEVE FUNZIONARE SEMPRE)
  try {
    const notifyRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sender: { name: 'Sistema Parrucchiere Power', email: 'info@parrucchierepower.it' },
        to: [{ email: 'info@parrucchierepower.it', name: 'Coach Masala' }],
        subject: 'NUOVA RICHIESTA AUDIT: ' + salone,
        htmlContent: `
          <div style="font-family:sans-serif;padding:20px;border:1px solid #C8A84B;">
            <h2 style="color:#C8A84B;">Nuova richiesta Audit Strategico</h2>
            <p><strong>Nome:</strong> ${nome} ${cognome}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Telefono:</strong> ${telefono} (Formattato: ${formattedPhone})</p>
            <p><strong>Salone:</strong> ${salone}</p>
            <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
            <p style="font-size:12px;color:#999;">Inviato dal form Diagnosi Avanzata - parrucchierepower.it</p>
          </div>
        `
      })
    });

    if (notifyRes.ok) {
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } else {
      const errData = await notifyRes.json();
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Brevo email error: ' + (errData.message || 'Errore sconosciuto') }) };
    }
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Errore di rete durante l\'invio dell\'email' }) };
  }
};
