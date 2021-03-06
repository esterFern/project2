const express = require('express');
const bcrypt = require('bcrypt');
const ObjectId = require('mongoose').Types.ObjectId;
const router = express.Router();
const { requireAnon, requireUser, requireFields, requireUserEditFields } = require('../middlewares/auth');
const User = require('../models/User');
const Story = require('../models/Story');
const Challenge = require('../models/Challenge');

const saltRounds = 10;

/* GET home page. */
router.get('/', requireAnon, (req, res, next) => {
  res.render('index');
});

router.get('/home', requireUser, async (req, res, next) => {
  const {_id} = req.session.currentUser;
  try {
    let user = await User.findById(_id);
    res.render('home', {user});
  } catch (error) {
    next(error);
  }
  
});

router.get('/info', (req, res, next) => {
  res.render('info');
});

router.get('/challenges/list', requireUser, async (req, res, next) => {
  try {
    let challenges = await Challenge.find();
    challenges = reverseArray(challenges);
    res.render('challenges/list', { challenges });
  } catch (error) {
    next(error);
  }
});

router.post('/challenges/list', requireUser, (req, res, next) => {
  const { filter } = req.body;
  if (filter === 'All') {
    res.redirect(`/challenges/list`);
    return;
  }
  res.redirect(`/challenges/list/${filter}`);
});


router.post('/challenges/list/search', requireUser, async (req, res, next) => {
  const{search} = req.body;
  if (search){
    res.redirect(`/challenges/list/search/${search}`);
    return;
  }else{
    res.redirect(`/challenges/list`);
  }
});

router.get('/challenges/list/search/:search', requireUser, async (req, res, next) => {
  const{search} = req.params;
  let challenges = [];
  try {
    const user = await User.find({username: {"$regex": search, "$options": 'i'}});
    challenges = await Challenge.find({objective: {"$regex": search, "$options": 'i'}});
    if(user){
      for (e of user){
        let challengesUserFound =  await Challenge.find({creator:e.id});
        challengesUserFound.forEach(e=>{
          let inChallenges =false;
          challenges.forEach(challenge=>{
            if(e.id === challenge.id){
              inChallenges = true;
            }
          });
          if(!inChallenges){
            challenges.push(e);
          }
        });
      }
    }
    challenges = reverseArray(challenges);
    res.render('challenges/list', {challenges});
  } catch (error) {
    next(error);
  }
});

router.get('/challenges/list/:filter', requireUser, async (req, res, next) => {
  const { filter } = req.params;
  try {
    let challenges = await Challenge.find({ genre: filter });
    challenges = reverseArray(challenges);
    res.render('challenges/list', { challenges, filter });
  } catch (error) {
    next(error);
  }
});

router.get('/challenges/new', requireUser, function (req, res, next) {
  const data = {
    messages: req.flash('validation')
  };
  res.render('challenges/create', data);
});

router.post('/challenges/new', requireUser, async (req, res, next) => {
  const { genre, objective } = req.body;
  const challenge = {
    genre,
    objective
  };

  try {
    if (!objective) {
      req.flash('validation', 'Fill the field');
      res.redirect('/challenges/new');
      return;
    }
    challenge.creator = req.session.currentUser._id;
    await Challenge.create(challenge);
    res.redirect('/challenges/my-challenges');
  } catch (error) {
    next(error);
  };
});

router.get('/challenges/my-challenges', requireUser, async (req, res, next) => {
  const { _id } = req.session.currentUser;
  try {
    let stories = await Story.find({ creator: _id, challenge: { $ne: null }, lastStory: null }).populate('challenge');
    let challenges = await Challenge.find({ creator: _id });
    stories = reverseArray(stories);
    challenges = reverseArray(challenges);
    res.render('challenges/my-challenges', { stories, challenges });
  } catch (error) {
    next(error);
  }
});

router.post('/challenges/my-challenges', requireUser, (req, res, next) => {
  const {filter} = req.body;
  if(filter === 'All'){
    res.redirect(`/challenges/my-challenges`);
    return;
  }
  res.redirect(`/challenges/my-challenges/${filter}`);
});

router.get('/challenges/my-challenges/:filter', requireUser, async (req, res, next) => {
  const{filter} = req.params;
  const { _id } = req.session.currentUser;

  try {
    let stories = await Story.find({ creator: _id, challenge: { $ne: null }, lastStory: null, genre:filter }).populate('challenge');
    let challenges = await Challenge.find({ creator: _id, genre:filter });
    challenges = reverseArray(challenges);
    stories = reverseArray(stories);
    res.render('challenges/my-challenges', { challenges, stories, filter });
  } catch (error) {
    next(error);
  }
});

router.get('/challenges/:id', requireUser, async (req, res, next) => {
  const { id } = req.params;
  if(!ObjectId.isValid(id)){
    return next();
  }
  try {
    const challenge = await Challenge.findById(id).populate('creator');
    const stories = await Story.find({ challenge: id, lastStory: null });
    res.render('stories/list', { stories, challenge });
  } catch (error) {
    next(error);
  }
});

router.get('/challenges/:id/new', requireUser, async (req, res, next) => {
  const { id } = req.params;
  const challenge = await Challenge.findById(id);
  const data = {
    messages: req.flash('validation')
  };
  if(!ObjectId.isValid(id)){
    return next();
  }
  res.render('stories/create', { challenge, data });
});

router.get('/account/edit', requireUser, async (req, res, next) => {
  const { _id } = req.session.currentUser;
  const data = {
    messages: req.flash('validation')
  };
  try {
    const user = await User.findById(_id);
    res.render('account-edit', { user, data });
  } catch (error) {
    next(error);
  };
});

router.post('/account/edit', requireUser, requireUserEditFields, async (req, res, next) => {
  let { username, email, password, confirmedPassword } = req.body;
  const { _id } = req.session.currentUser;

  try {
    const resultName = await User.findOne({ username });
    if (resultName && (resultName.id !== _id)) {
      req.flash('validation', 'This username is taken');
      res.redirect('/account/edit');
      return;
    }

    const resultEmail = await User.findOne({ email });
    if (resultEmail && (resultEmail.id !== _id)) {
      req.flash('validation', 'There is an account with this email');
      res.redirect('/account/edit');
      return;
    }

    if (!password) {
      const passwordUser = await User.findOne({ _id });
      password = passwordUser.password;
    } else {
      if (password === confirmedPassword) {
        const salt = bcrypt.genSaltSync(saltRounds);
        password = bcrypt.hashSync(password, salt);
      } else {
        req.flash('validation', 'The password fields do not match');
        res.redirect('/account/edit');
        return;
      }
    }

    const newInfo = {
      username,
      email,
      password
    };
    await User.findByIdAndUpdate(_id, newInfo);
    req.flash('validation', 'The changes have been done successfully');
    res.redirect('/account/edit');
  } catch (error) {
    next(error);
  }
});

function reverseArray(arr){
  let newArr = [];
  for(let i = arr.length-1; i>=0; i--){
    newArr.push(arr[i]);
  }

  return newArr;
}

module.exports = router;
