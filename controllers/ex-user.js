const user = require("../models/user");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const nodemailer = require("nodemailer");
var generator = require("generate-password");

const AddUser = async (req, res) => {
  const { email, name, age } = req.body;

  console.log(req.body);
  let existUser;
  try {
    existUser = await user.findOne({ email: email });
  } catch (error) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong while checking xisting user",
      data: error,
    });
  }

  if (existUser) {
    return res
      .status(200)
      .json({ sucess: false, message: "email alreay exist", data: null });
  }
  let pic = "avatar.png";
  console.log("File", req.file);
  if (req.file) {
    pic = req.file.filename;
  }
  let password;
  if (!req.body.password) {
    password = generator.generate({
      length: 8,
      numbers: true,
    });
  } else {
    password = req.body.password;
  }
  console.log(password);
  let hashedPassword = await bcrypt.hash(password, 10);
  const NewUser = new user({
    email,
    name,
    age,
    pic,
    password: hashedPassword,
  });

  try {
    await NewUser.save();
  } catch (error) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong while saving new user",
      data: error,
    });
  }

  var transporter = nodemailer.createTransport({
    // host: "smtp.mailtrap.io",
    service: "gmail",
    // port: 2525,
    auth: {
      user: "contact.io.domic@gmail.com",
      pass: "qbytjxdszybbgrng",
    },
  });

  let info = await transporter.sendMail({
    from: "contact.io.domic@gmail.com", // sender address
    to: email, // list of receivers
    subject: "New Account Created", // Subject line
    // text: "Hello world?", // plain text body
    html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 20px;">
              <h1 style="text-align: center; color: #3d3d3d; margin-bottom: 40px;">Welcome to Our App!</h1>
              <p style="font-size: 18px; color: #3d3d3d;">Dear ${name},</p>
              <p style="font-size: 18px; color: #3d3d3d;">Your new account has been successfully created in our App as a(n) <strong>Simple User</strong>.</p>
              <p style="font-size: 18px; color: #3d3d3d;">Please keep your password in a safe place. You can change your password anytime by logging into your account.</p>
              <p style="font-size: 18px; color: #3d3d3d;">Here is your password: <strong>${password}</strong></p>
              <div style="text-align: center; margin-top: 40px;">
                  <a href="http://localhost:5173/" style="display: inline-block; background-color: #0066ff; color: white; font-size: 18px; padding: 12px 30px; text-decoration: none; border-radius: 30px;">Check out our App</a>
              </div>
              <p style="font-size: 16px; color: #666; margin-top: 40px;">Thank you for using our App!</p>
          </div>
      </div>
          `, // html body
  });

  return res
    .status(201)
    .json({ sucess: true, message: "user added successfully", data: NewUser });
  // return res
  //   .status(201)
  //   .json({ sucess: true, message: "user added successfully", data: req.file });
};

const FindUserById = async (req, res) => {
  const { id } = req.params;
  let existUser;
  try {
    existUser = await user.findById(id);
  } catch (error) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong while checking xisting user",
      data: error,
    });
  }

  if (!existUser) {
    return res
      .status(200)
      .json({ sucess: false, message: "user doesn't exist", data: null });
  }

  return res.status(200).json({
    sucess: true,
    message: "user was found successfully",
    data: existUser,
  });
};

const AllUser = async (req, res) => {
  let allUsers;
  try {
    allUsers = await user.find();
  } catch (error) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong while checking xisting user",
      data: error,
    });
  }

  return res.status(200).json({
    sucess: true,
    message: "all users was found successfully",
    data: allUsers,
  });
};

const UpdateUser = async (req, res) => {
  const { id } = req.params;
  const { email, name, age, password } = req.body;
  let existUser;
  try {
    existUser = await user.findById(id);
  } catch (error) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong while checking xisting user",
      data: error,
    });
  }

  if (!existUser) {
    return res
      .status(200)
      .json({ sucess: false, message: "user doesn't exist", data: null });
  }
  if (req.file) {
    if (existUser.pic !== "avatar.png") {
      let path = `./uploads/images/${existUser.pic}`;

      try {
        fs.unlinkSync(path);
      } catch (error) {
        console.log(error);
        return res.status(500).json({
          sucess: false,
          message: "Something went wrong while deleting user picture",
          data: error,
        });
      }
    }
    existUser.pic = req.file.filename;
  }

  existUser.email = email;
  existUser.name = name;
  existUser.age = age;

  try {
    await existUser.save();
  } catch (error) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong while saving new user",
      data: error,
    });
  }

  return res.status(201).json({
    sucess: true,
    message: "user updatd successfully",
    data: existUser,
  });
};

const DeleteUser = async (req, res) => {
  const { id } = req.params;
  let existUser;
  try {
    existUser = await user.findById(id);
  } catch (error) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong while checking xisting user",
      data: error,
    });
  }

  if (!existUser) {
    return res
      .status(200)
      .json({ sucess: false, message: "user doesn't exist", data: null });
  }

  if (existUser.pic !== "avatar.png") {
    let path = `./uploads/images/${existUser.pic}`;

    try {
      fs.unlinkSync(path);
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        sucess: false,
        message: "Something went wrong while deleting user picture",
        data: error,
      });
    }
  }

  try {
    await existUser.deleteOne();
  } catch (error) {
    return res.status(500).json({
      sucess: false,
      message: "Something went wrong while delete user",
      data: error,
    });
  }

  return res.status(200).json({
    sucess: true,
    message: "user was deleted successfully",
    data: null,
  });
};

const login = async (req, res) => {
  // get data
  // check email in db
  // compare password
  // res
};

const register = async (req, res) => {
  // get data
  // check email in db
  // hash password
  // save user
  // res
};

const Hello = (req, res) => {
  const { name } = req.params;
  return res.json({
    staus: "success",
    message: `welcome Mr ${name}`,
    error: false,
  });
};

exports.Hello = Hello;
exports.AddUser = AddUser;
exports.AllUser = AllUser;
exports.FindUserById = FindUserById;
exports.DeleteUser = DeleteUser;
exports.UpdateUser = UpdateUser;
