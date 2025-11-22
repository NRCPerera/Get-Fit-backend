const success = (res, data = {}, message = 'OK', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const error = (res, message = 'Error', statusCode = 500) => {
  return res.status(statusCode).json({ success: false, error: message });
};

module.exports = { success, error };


