const ObjectID = require("mongodb").ObjectID
const usersCollection = require("../db").db().collection("users")
const followsCollection = require("../db").db().collection("follows")
const User = require("./User")

let Follow = function (followedUsername, authorId) {
  this.followedUsername = followedUsername
  this.authorId = authorId
  this.errors = []
}

Follow.prototype.cleanUp = function () {
  if (typeof this.followedUsername != "string") {
    this.followedUsername = ""
  }
}

Follow.prototype.validate = async function (action) {
  // followed username must exist in database
  let followedAccount = await usersCollection.findOne({ username: this.followedUsername })
  if (followedAccount) {
    this.followedId = followedAccount._id
  } else {
    this.errors.push("You cannot follow a user that does not exist.")
  }

  let doesFollowAlreadyExist = await followsCollection.findOne({ followedId: this.followedId, authorId: ObjectID(this.authorId) })
  if (action == "create") {
    if (doesFollowAlreadyExist) {
      this.errors.push("You are already following this user.")
    }
  }
  if (action == "delete") {
    if (!doesFollowAlreadyExist) {
      this.errors.push("You cannot stop following somebody you do not already follow.")
    }
  }
  // should not be able to follow yourself
  if (this.followedId.equals(this.authorId)) {
    this.errors.push("You cannot follow yourself.")
  }
}

Follow.prototype.create = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp()
    await this.validate("create")
    if (!this.errors.length) {
      await followsCollection.insertOne({ followedId: this.followedId, authorId: new ObjectID(this.authorId) })
      resolve()
    } else {
      reject(this.errors)
    }
  })
}

Follow.prototype.delete = function () {
  return new Promise(async (resolve, reject) => {
    this.cleanUp()
    await this.validate("delete")
    if (!this.errors.length) {
      await followsCollection.deleteOne({ followedId: this.followedId, authorId: new ObjectID(this.authorId) })
      resolve()
    } else {
      reject(this.errors)
    }
  })
}

Follow.isVisitorFollowing = async function (followedId, visitorId) {
  let followDoc = await followsCollection.findOne({ followedId: followedId, authorId: new ObjectID(visitorId) })
  if (followDoc) {
    return true
  } else {
    return false
  }
}

Follow.getFollowersById = function (id) {
  return new Promise(async (resolve, reject) => {
    try {
      // create new variable to assign the array of followers to
      let followers = await followsCollection
        .aggregate([
          // looks in the follows collection for a any documents with a followedId matching the id given
          { $match: { followedId: id } },
          // looks in user collection, for all _ids that match the authorId in the current follows collection documents
          // then it will put those as an array onto the current follows collection documents
          { $lookup: { from: "users", localField: "authorId", foreignField: "_id", as: "userDoc" } },
          {
            $project: {
              // takes the data returned and then lets you choose exactly what properties to return
              // it won't return any properties unless you say so
              // i want it to return the username and email of each follower
              username: { $arrayElemAt: ["$userDoc.username", 0] },
              email: { $arrayElemAt: ["$userDoc.email", 0] },
            },
          },
        ])
        .toArray()

      // map through the returned array to create a new user for each user returned in the array
      // doing this in order to turn the email into the gravatar url
      followers = followers.map(function (follower) {
        // create a user based on the model
        let user = new User(follower, true)
        // return the user
        return { username: follower.username, avatar: user.avatar }
      })
      resolve(followers)
    } catch {
      reject()
    }
  })
}

Follow.getFollowingById = function (id) {
  return new Promise(async (resolve, reject) => {
    try {
      // create new variable to assign the array of followers to
      let followers = await followsCollection
        .aggregate([
          // looks in the follows collection for a any documents with an AUTHORID matching the id given
          { $match: { authorId: id } },
          // looks in user collection, for all _ids that match the FOLLOWEDID in the current follows collection documents
          // then it will put those as an array onto the current follows collection documents
          { $lookup: { from: "users", localField: "followedId", foreignField: "_id", as: "userDoc" } },
          {
            $project: {
              // takes the data returned and then lets you choose exactly what properties to return
              // it won't return any properties unless you say so
              // i want it to return the username and email of each follower
              username: { $arrayElemAt: ["$userDoc.username", 0] },
              email: { $arrayElemAt: ["$userDoc.email", 0] },
            },
          },
        ])
        .toArray()

      // map through the returned array to create a new user for each user returned in the array
      // doing this in order to turn the email into the gravatar url
      followers = followers.map(function (follower) {
        // create a user based on the model
        let user = new User(follower, true)
        // return the user
        return { username: follower.username, avatar: user.avatar }
      })
      resolve(followers)
    } catch {
      reject()
    }
  })
}

Follow.countFollowersById = function (id) {
  return new Promise(async (resolve, reject) => {
    let followerCount = await followsCollection.countDocuments({ followedId: id })
    resolve(followerCount)
  })
}

Follow.countFollowingById = function (id) {
  return new Promise(async (resolve, reject) => {
    let followingCount = await followsCollection.countDocuments({ authorId: id })
    resolve(followingCount)
  })
}

module.exports = Follow
