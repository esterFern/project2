'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  voted: {
    type: [String]
  },
  favorites: {
    type: [String]
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
