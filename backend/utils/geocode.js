
const axios = require("axios");

const geocodeAddress = async (address) => {
  const res = await axios.get(
    "https://api.opencagedata.com/geocode/v1/json",
    {
      params: {
        q: address,
        key: process.env.OPENCAGE_API_KEY,
        limit: 1
      }
    }
  );

  const result = res.data.results[0];

  if (!result) throw new Error("Location not found");

  return {
    lat: result.geometry.lat,
    lng: result.geometry.lng,
    formatted: result.formatted
  };
};

module.exports = { geocodeAddress };