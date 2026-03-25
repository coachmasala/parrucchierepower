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

  const BREVO_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_KEY) {
    console.error('ERRORE: BREVO_API_KEY non configurata su Netlify');
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Configurazione server mancante (API KEY)' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'api-key': BREVO_KEY
  };

  // 1. Tentativo aggiunta contatto a Brevo (Lista 3 - la stessa della landing principale per sicurezza)
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
        listIds: [3], // Uso l'ID 3 che sappiamo funzionare per l'altra landing
        updateEnabled: true
      })
    });
    if (!contactRes.ok) {
      const errText = await contactRes.text();
      console.warn('Brevo contact warning (non bloccante):', errText);
    }
  } catch(e) {
    console.error('Brevo contact fetch error:', e);
  }

  // 2. Invio email di notifica a Coach Masala (QUESTA DEVE FUNZIONARE SEMPRE)
  let notificationSent = false;
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
            <hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
            <p style="font-size:12px;color:#999;">Inviato dal form Diagnosi Avanzata - parrucchierepower.it</p>
          </div>
        `
      })
    });
    notificationSent = notifyRes.ok;
    if (!notifyRes.ok) {
      const errText = await notifyRes.text();
      console.error('Brevo notification error:', errText);
    }
  } catch(e) {
    console.error('Notification fetch error:', e);
  }

  // 3. Invio conferma all'utente
  try {
    const confirmRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sender: { name: 'Coach Masala', email: 'info@parrucchierepower.it' },
        to: [{ email, name: nome }],
        subject: 'Ricevuto: La tua richiesta per l\'Audit Strategico',
        htmlContent: `
          <div style="background:#1A1814;padding:48px 40px;font-family:Georgia,serif;max-width:560px;margin:0 auto;">
            <p style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C8A84B;margin-bottom:32px;">PARRUCCHIERE POWER SRL</p>
            <h1 style="font-size:28px;font-weight:300;color:#FDFCF8;line-height:1.2;margin-bottom:16px;">Ciao ${nome},</h1>
            <p style="font-size:15px;color:rgba(253,252,248,0.55);line-height:1.8;margin-bottom:32px;">
              Ho ricevuto la tua richiesta per l'<strong>Audit Strategico</strong> per il salone <strong>${salone}</strong>.
              Ti contatteremo a breve al numero ${telefono} per definire i prossimi passi.
            </p>
            <p style="font-size:12px;color:rgba(253,252,248,0.2);margin-top:40px;line-height:1.6;font-family:sans-serif;">
              Parrucchiere Power Srl — parrucchierepower.it
            </p>
          </div>
        `
      })
    });
  } catch(e) {
    console.error('Confirmation fetch error:', e);
  }

  // Se almeno la notifica a te è partita, diamo successo all'utente per non farlo scappare
  if (notificationSent) {
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };
  } else {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Errore durante l\'invio. Riprova o scrivici a info@parrucchierepower.it' })
    };
  }
};
