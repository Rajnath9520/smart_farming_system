const { db } = require("../config/firebase");

async function deleteHistory() {
  try {
    await db().ref("sensor_history").remove();
    console.log("sensor_history deleted successfully");
  } catch (error) {
    console.error("Error deleting:", error);
  }
}

deleteHistory();