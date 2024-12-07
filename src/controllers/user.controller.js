import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js"
import { ApiResponse } from "../utils/apiResponse.js"
import { User } from "../models/user.model.js"
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    // console.log("Tokens : ", accessToken , " " , refreshToken)
    return { accessToken, refreshToken }
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
}

const registerUser = asyncHandler(async (req, res) => {

  // 1. get user details from frontend
  const { fullName, email, username, password } = req.body
  // console.log("email: ", email);
  console.log(req.body);

  // 2. validation checking if empty
  if(
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // 3. check if user already exist
  const userExist = await User.findOne({
    $or: [{ username }, { email }]
  });
  if(userExist){
    throw new ApiError(409, "User already exist");
  }

  // 4. check for assets(avatar)
  // 5. upload to cloudinary/aws s3

  // 6. create user object - create entry in db
  const user = await User.create({
    fullName,
    email,
    username,
    password,
  });

  // 7. remove password and refresh token from response
  const newUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // 8. check for user creation
  if(!newUser){
    throw new ApiError(500, "Something went wrong while creating user");
  }

  // 9. return res

  return res.status(201).json(
    new ApiResponse(200, newUser, "User registered successfully")
  );

});

const loginUser = asyncHandler(async(req, res) => {

  // 1. get user details from frontend
  const { email, username, password } = req.body;

  // 2. validate if not empty
  if(!(username || email)){
    throw new ApiError(400, "username or email is required");
  }

  // 3. check if user with email exist
  const user = await User.findOne({
    $or: [{ username }, { email }]
  });
  if(!user){
    throw new ApiError(404, "User does not exist");
  }

  // 4. check password
  const isPasswordValid = await user.isPasswordCorrect(password);
  if(!isPasswordValid){
    throw new ApiError(401, "Invalid credentials");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

  const loggedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // 6. return response
  const options = {
    httpOnly: true,
    secure: true,
  }
  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedUser,
        accessToken,
        refreshToken
      },
      "User loggedIn successfully"
    )
  )
});

const logoutUser = asyncHandler(async(req, res) => {
  // const await User.findById() kaha se lau???
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )
  const options = {
    httpOnly: true,
    secure: true,
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "user logged out"))
});

const refreshAccessToken = asyncHandler(async(req, res) => {

  try {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
      throw new ApiError(401, "Unauthorized Request");
    }

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken._id);

    if(!user) throw new ApiError(401, "Invalid RefreshToken");

    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401, "Refresh Token is expired or invalid");
    }

    const options = {
      httpsOnly: true,
      secure: true,
    }

    const { accessToken, newRefreshToken } = await generateAccessAndRefreshToken(user._id);

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "access Token refreshed"
      )
    );

  } catch (error) {
    throw new ApiError(401, error.message || "Error while refreshing token");
  }

});

export { registerUser, loginUser, generateAccessAndRefreshToken, logoutUser, refreshAccessToken }