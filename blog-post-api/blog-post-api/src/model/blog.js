const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const BlogSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    imgurl: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
    categories: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    date: {
      type: String,
    },
    more: {
      type: String,
      default: "1",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

BlogSchema.plugin(uniqueValidator);
module.exports = model("Blog", BlogSchema);
