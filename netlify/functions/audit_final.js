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
    telefono = (body.telefono || '').trim().replace(/\s+/g, '');
    salone   = (body.salone   || '').trim();
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Dati non validi' }) };
  }

  if (!nome || !email || !cognome || !telefono || !salone) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Tutti i campi sono obbligatori' }) };
  }

  const BREVO_KEY = process.env.BREVO_API_KEY_LANDING;
  const headers = {
    'Content-Type': 'application/json',
    'api-key': BREVO_KEY || ''
  };

  // 1. Tentativo aggiunta contatto a Brevo (Lista 6)
  if (BREVO_KEY) {
    try {
      // Assicuriamoci che il telefono abbia il prefisso +39 se manca (doppio controllo lato server)
      let formattedPhone = telefono;
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('00')) {
          formattedPhone = '+' + formattedPhone.substring(2);
        } else {
          formattedPhone = '+39' + formattedPhone;
        }
      }
      
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

      console.log('Sending to Brevo:', JSON.stringify(contactPayload));

      const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify(contactPayload)
      });

      if (!contactRes.ok) {
        const errData = await contactRes.json();
        console.error('Brevo contact error details:', JSON.stringify(errData));
      }
    } catch(e) {
      console.error('Brevo contact error (silenced):', e.message);
    }
  }

  // 2. Invio email di notifica a Coach Masala
  if (BREVO_KEY) {
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
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
              <p><strong>Telefono:</strong> ${telefono}</p>
              <p><strong>Salone (JOB_TITLE):</strong> ${salone}</p>
            </div>
          `
        })
      });
    } catch(e) {
      console.error('Brevo email error (silenced):', e.message);
    }
  }

  // 3. RESTITUISCO SEMPRE SUCCESSO ALL'UTENTE
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'Richiesta ricevuta correttamente' })
  };
};
