import mongoose, { PassportLocalSchema } from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';

const Schema = mongoose.Schema;

const accountSchema = new Schema({
    username: String,
    password: String
});

accountSchema.plugin(passportLocalMongoose);

const Account: mongoose.PassportLocalModel<mongoose.PassportLocalDocument> = mongoose.model('User', accountSchema as PassportLocalSchema);

export default Account;