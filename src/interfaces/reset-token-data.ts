export default interface ResetTokenData {
    type: string,
    email: string,
    username: string,
    resetId: string,
    exp: number
  }