import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js"
import { ApiResponse } from "../utils/apiResponse.js"
import { User } from "../models/user.model.js"

const registerUser = asyncHandler( async (req, res) => {

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

export { registerUser, }