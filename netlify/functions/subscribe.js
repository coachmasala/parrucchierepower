exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  let nome, email;
  try {
    const body = JSON.parse(event.body);
    nome  = (body.nome  || '').trim();
    email = (body.email || '').trim();
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Dati non validi' }) };
  }

  if (!nome || !email) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Nome e email obbligatori' }) };
  }

  const BREVO_KEY = process.env.BREVO_API_KEY;
  const PDF_URL   = 'https://parrucchierepower.it/7_Errori_Margine_ParrucchierePower.pdf';

  const headers = {
    'Content-Type': 'application/json',
    'api-key': BREVO_KEY
  };

  try {
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: nome },
        listIds: [3],
        updateEnabled: true
      })
    });
    if (!contactRes.ok && contactRes.status !== 204) {
      const err = await contactRes.text();
      console.error('Brevo contact error:', err);
    }
  } catch(e) {
    console.error('Contact fetch error:', e);
  }

  try {
    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sender: { name: 'Coach Masala', email: 'info@parrucchierepower.it' },
        to: [{ email, name: nome }],
        subject: 'La tua guida: 7 Errori che costano margine al tuo salone',
        htmlContent: `
          <div style="background:#1A1814;padding:48px 40px;font-family:Georgia,serif;max-width:560px;margin:0 auto;">
            <p style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C8A84B;margin-bottom:32px;">PARRUCCHIERE POWER SRL</p>
            <h1 style="font-size:28px;font-weight:300;color:#FDFCF8;line-height:1.2;margin-bottom:16px;">Ciao ${nome},<br>ecco la tua guida.</h1>
            <p style="font-size:15px;color:rgba(253,252,248,0.55);line-height:1.8;margin-bottom:32px;">
              Hai richiesto <strong style="color:#C8A84B;">7 Errori che costano margine ai saloni strutturati</strong>.
              Clicca il pulsante qui sotto per scaricare il PDF.
            </p>
            <a href="${PDF_URL}" style="display:inline-block;background:#C8A84B;color:#1A1814;padding:14px 28px;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:600;text-decoration:none;font-family:sans-serif;">Scarica la guida PDF</a>
            <p style="font-size:12px;color:rgba(253,252,248,0.2);margin-top:40px;line-height:1.6;font-family:sans-serif;">
              Parrucchiere Power Srl — parrucchierepower.it<br>
              Per cancellarti rispondi con oggetto "cancellami".
            </p>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Brevo email error:', err);
      return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Errore invio email' }) };
    }
  } catch(e) {
    console.error('Email fetch error:', e);
    return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Errore di rete' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
