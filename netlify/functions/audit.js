exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  let nome, cognome, email, telefono, salone;
  try {
    const body = JSON.parse(event.body);
    nome     = (body.nome     || '').trim();
    cognome  = (body.cognome  || '').trim();
    email    = (body.email    || '').trim();
    telefono = (body.telefono || '').trim();
    salone   = (body.salone   || '').trim();
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Dati non validi' }) };
  }

  if (!nome || !email || !cognome || !telefono || !salone) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Tutti i campi sono obbligatori' }) };
  }

  const BREVO_KEY = process.env.BREVO_API_KEY_LANDING;
  if (!BREVO_KEY) {
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Configurazione server mancante (BREVO_API_KEY_LANDING non trovata su Netlify)' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'api-key': BREVO_KEY
  };

  // 1. Aggiunta contatto a Brevo (Lista 6) - QUESTO DEVE ESSERE BLOCCANTE PER LA DIAGNOSI
  try {
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        attributes: { 
          FIRSTNAME: nome, 
          LASTNAME: cognome, 
          SMS: telefono, 
          COMPANY: salone 
        },
        listIds: [6],
        updateEnabled: true
      })
    });
    
    if (!contactRes.ok) {
      const errData = await contactRes.json();
      // Se l'errore è che il contatto esiste già, proseguiamo comunque
      if (contactRes.status !== 400 || !errData.message.includes('already exists')) {
        console.error('Brevo contact error:', errData);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Brevo contact error: ' + (errData.message || 'Errore sconosciuto') }) };
      }
    }
  } catch(e) {
    console.error('Brevo contact fetch error:', e);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Errore di rete durante la creazione del contatto' }) };
  }

  // 2. Invio email di notifica a Coach Masala
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
            <p><strong>Telefono:</strong> ${telefono}</p>
            <p><strong>Salone:</strong> ${salone}</p>
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
