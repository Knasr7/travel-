const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../../model/user");
const { use } = require("./auth-routes");

const register = async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
        success: false,
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const user = new User({
      username,
      email,
      name,
      password: hashedPassword,
    });

    await user.save();

    // Generate JWT token
    const accessToken = jwt.sign(
      {
        UserInfo: {
          userId: user._id,
          email: user.email,
          username: user.username,
        },
      },
      process.env.ACCESS_TOKEN_SECRET
    );

    res.status(201).json({
      message: "Account successfully created",
      user,
      token: accessToken,
      success: true,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }

    // Check if the user exists
    const foundUser = await User.findOne({ email }).select("+password").exec();
    if (!foundUser || !foundUser.active) {
      return res.status(401).json({
        message: "Unauthorized",
        success: false,
      });
    }

    // Validate the password
    const isPasswordValid = await bcrypt.compare(password, foundUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials",
        success: false,
      });
    }

    // Generate JWT token
    const accessToken = jwt.sign(
      {
        UserInfo: {
          userId: foundUser._id,
          email: foundUser.email,
          username: foundUser.username,
        },
      },
      process.env.ACCESS_TOKEN_SECRET
    );

    const result = await foundUser.save();
    console.log(result);

    res.json({
      token: accessToken,
      user: result,
      message: "Login is successful",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};

// There is need for refresh because access token has expired.
const refresh = async (req, res) => {
  console.log(req.cookies);
  try {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(401);
    const refreshToken = cookies.jwt;
    res.clearCookie("jwt", { httpOnly: true, sameSite: "None", secure: true });

    const foundUser = await User.findOne({ refreshToken }).exec();

    // Detected refresh token reuse!
    if (!foundUser) {
      jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        async (err, decoded) => {
          if (err) return res.sendStatus(403); //Forbidden
          console.log("attempted refresh token reuse!");
          const hackedUser = await User.findOne({
            username: decoded.username,
          }).exec();
          hackedUser.refreshToken = [];
          const result = await hackedUser.save();
          console.log(result);
        }
      );
      return res.sendStatus(403); //Forbidden
    }

    const newRefreshTokenArray = foundUser.refreshToken.filter(
      (rt) => rt !== refreshToken
    );

    // evaluate jwt
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      async (err, decoded) => {
        if (err) {
          console.log("expired refresh token");
          foundUser.refreshToken = [...newRefreshTokenArray];
          const result = await foundUser.save();
          console.log(result);
        }
        if (err || foundUser.username !== decoded.username)
          return res.sendStatus(403);

        // Refresh token was still valid
        const accessToken = jwt.sign(
          {
            UserInfo: {
              username: decoded.username,
            },
          },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "10s" }
        );

        const newRefreshToken = jwt.sign(
          { username: foundUser.username },
          process.env.REFRESH_TOKEN_SECRET,
          { expiresIn: "1d" }
        );
        // Saving refreshToken with current user
        foundUser.refreshToken = [...newRefreshTokenArray, newRefreshToken];
        const result = await foundUser.save();

        // Creates Secure Cookie with refresh token
        res.cookie("jwt", newRefreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: "None",
          maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
          accessToken: accessToken,
          result: result,
        });
      }
    );
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      success: false,
    });
  }
};

//There is need for logout just to clear cookie if exists
const logout = async (req, res) => {
  // On client, also delete the accessToken

  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); //No content
  const refreshToken = cookies.jwt;

  // Is refreshToken in db?
  const foundUser = await User.findOne({ refreshToken }).exec();
  if (!foundUser) {
    res.clearCookie("jwt", { httpOnly: true, sameSite: "None", secure: true });
    return res.sendStatus(204);
  }

  // Delete refreshToken in db
  foundUser.refreshToken = foundUser.refreshToken.filter(
    (rt) => rt !== refreshToken
  );
  const result = await foundUser.save();
  console.log(result);

  res.clearCookie("jwt", { httpOnly: true, sameSite: "None", secure: true });
  res.sendStatus(204).json({
    message: "Cookie cleared",
    success: "true",
  });
};

module.exports = {
  register,
  login,
  refresh,
  logout,
};
