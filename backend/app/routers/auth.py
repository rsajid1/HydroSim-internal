import boto3
from fastapi import APIRouter
from fastapi import HTTPException, status, Depends
from pydantic import BaseModel
from pydantic import BaseModel, EmailStr
from botocore.exceptions import ClientError
from config.config import settings
import hmac
import hashlib
import base64
from fastapi import APIRouter, HTTPException

# Check cognito settings
if not settings.cognito_region or not settings.cognito_user_pool_id or not settings.cognito_client_id:
    raise Exception("Cognito configuration is missing or incomplete. Please set cognito_region, cognito_user_pool_id, and cognito_client_id in your settings.")


def get_secret_hash(username, client_id, client_secret):
    message = username + client_id
    dig = hmac.new(client_secret.encode('utf-8'), msg=message.encode('utf-8'), digestmod=hashlib.sha256).digest()
    return base64.b64encode(dig).decode()


# Authentication route
router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


# Model for user signup
class SignupModel(BaseModel):
    email: str
    password: str


class LoginModel(BaseModel):
    email: str
    password: str



class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ConfirmForgotPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str



cognito_client = boto3.client('cognito-idp', region_name=settings.cognito_region)


# Signup endpoint
@router.post("/signup")
async def signup(user: SignupModel):
    try:
        secret_hash = get_secret_hash(user.email, settings.cognito_client_id, settings.cognito_client_secret)
        response = cognito_client.sign_up(
            ClientId=settings.cognito_client_id,
            Username=user.email,
            Password=user.password,
            SecretHash=secret_hash,
            UserAttributes=[
                {'Name': 'email', 'Value': user.email}
            ]
        )
        
        #Debug full response
        print("Cognito response:", response)
        
        return {"message": "User signed up successfully"}
    except ClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.response['Error']['Message'])


# Login endpoint
@router.post("/login")
async def login(user: LoginModel):
    try:
        secret_hash = get_secret_hash(user.email, settings.cognito_client_id, settings.cognito_client_secret)
        response = cognito_client.initiate_auth(
            ClientId=settings.cognito_client_id,
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={
                'USERNAME': user.email,
                'PASSWORD': user.password,
                'SECRET_HASH': secret_hash
            }
        )
        
        return {
            "access_token": response['AuthenticationResult']['AccessToken'],
            "id_token": response['AuthenticationResult']['IdToken'],
            "refresh_token": response['AuthenticationResult']['RefreshToken'],
            "token_type": response['AuthenticationResult']['TokenType'],
            "expires_in": response['AuthenticationResult']['ExpiresIn']
        }
    except ClientError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=e.response['Error']['Message'])
    

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    try:
        cognito_client.forgot_password(
            ClientId=settings.cognito_client_id,
            SecretHash=get_secret_hash(request.email, settings.cognito_client_id, settings.cognito_client_secret),
            Username=request.email
        )
        return {"message": "Reset code sent to your email"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/confirm-forgot-password")
async def confirm_forgot_password(request: ConfirmForgotPasswordRequest):
    try:
        cognito_client.confirm_forgot_password(
            ClientId=settings.cognito_client_id,
            SecretHash=get_secret_hash(request.email, settings.cognito_client_id, settings.cognito_client_secret),
            Username=request.email,
            ConfirmationCode=request.code,
            Password=request.new_password
        )
        return {"message": "Password reset successful. Please login."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

