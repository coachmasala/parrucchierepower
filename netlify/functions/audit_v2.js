exports.handler = async function(event) {
  return {
    statusCode: 200,
    body: JSON.stringify({ 
      success: true, 
      message: 'TEST: Funzione Netlify Raggiunta con Successo.' 
    })
  };
};
