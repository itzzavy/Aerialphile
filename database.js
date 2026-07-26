const { MongoClient } = require("mongodb");

module.exports = async (client) => {

  const mongo = new MongoClient(process.env.MONGO_URI);

  await mongo.connect();

  const db = mongo.db("botdata");

  client.commandsDB = db.collection("commands");
  client.protectedUsersDB = db.collection("protectedUsers");
  client.cleanChannelsDB = db.collection("cleanChannels");
  client.reactDB = db.collection("emiireact");
  client.birthdayDB = db.collection("birthdays");
  client.staffDB = db.collection("staff");
  client.updateStateDB = db.collection("updateState");

  console.log("Connected to MongoDB");

};