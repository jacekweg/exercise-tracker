const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const { Schema } = mongoose;

require("dotenv").config();

const mongoUri = process.env["MONGO_URI"];

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const mwareLogger = (req, res, next) => {
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  next();
};

const userSchema = Schema({
  username: {
    type: String,
    required: true,
  },
});

const exerciseSchema = Schema({
  userId: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);
const Exercise = mongoose.model("Exercise", exerciseSchema);

app.use(cors());
app.use(mwareLogger);
app.use(express.urlencoded({ extended: false }));
app.use("/js", express.static(__dirname + "/node_modules/bootstrap/dist/js"));
app.use("/js", express.static(__dirname + "/node_modules/jquery/dist"));
app.use("/css", express.static(__dirname + "/node_modules/bootstrap/dist/css"));

const isValidDate = (dateString) => {
  const regEx = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateString.match(regEx)) return false;
  const d = new Date(dateString);
  const dNum = d.getTime();
  if (!dNum && dNum !== 0) return false;
  return d.toISOString().slice(0, 10) === dateString;
};

const isInt = (value) => {
  return !isNaN(value) && parseInt(Number(value)) === Number(value) && !isNaN(parseInt(value, 10));
};

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/view/index.html");
});

app.get("/api/users", async (req, res) => {
  const response = await User.find({});
  res.json(response.map((e) => ({ _id: e._id, username: e.username })));
});

app.post("/api/users", async (req, res) => {
  if (!req.body.username) {
    res.status(400).json({ error: "username is required" });
    return;
  }
  await User.create({ username: req.body.username });
  const response = await User.findOne({ username: req.body.username });
  res.json({ username: response.username, _id: response._id });
});

app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    const user = await User.findById(req.params._id);
    const exercises = await Exercise.find({ userId: req.params._id });

    if (req.query.from && !isValidDate(req.query.from)) req.query.from = undefined;
    if (req.query.to && !isValidDate(req.query.to)) req.query.to = undefined;
    if (req.query.limit && !isInt(req.query.limit)) req.query.limit = undefined;

    const filtered = exercises.filter((e) => {
      const exerDate = new Date(new Date(e.date).toDateString());

      if (req.query.from && new Date(req.query.from) > exerDate) return false;
      if (req.query.to && new Date(req.query.to) < exerDate) return false;

      if (req.query.limit && req.query.limit > 0) req.query.limit--;
      else if (req.query.limit === 0) return false;

      return true;
    });

    res.json({
      _id: user._id,
      username: user.username,
      count: filtered.length,
      log: filtered.map((e) => ({
        description: e.description,
        duration: e.duration,
        date: new Date(e.date + "GMT+0200").toDateString(),
      })),
    });
  } catch (e) {
    res.json({ error: e });
  }
});

app.post("/api/users//exercises", async (req, res) => {
  res.status(400).json({ error: "missing user id" });
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  if (!req.params._id || !req.body.description || !req.body.duration) {
    res.status(400).json({ error: "missing required fields" });
    return;
  }

  if (isNaN(Number(req.body.duration))) {
    res.status(400).json({ error: "duration must be a number" });
    return;
  }

  if (req.body.date && !isValidDate(req.body.date)) {
    res.status(400).json({ error: "date must be in the format yyyy-mm-dd" });
    return;
  }

  try {
    const newExercise = await Exercise.create({
      userId: req.params._id,
      description: req.body.description,
      duration: req.body.duration,
      date: req.body.date ? req.body.date : undefined,
    });

    const user = await User.findById(req.params._id);

    if (!user) {
      res.status(400).json({ error: "user not found" });
      return;
    }

    res.json({
      _id: user._id,
      username: user.username,
      description: newExercise.description,
      duration: newExercise.duration,
      date: new Date(newExercise.date).toDateString(),
    });
    return;
  } catch (CastError) {
    res.json({ error: e });
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
