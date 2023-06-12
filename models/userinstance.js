"use strict";

const { STRING } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const UserInstance = sequelize.define(
    "UserInstance",
    {
      name: DataTypes.STRING,
      key: DataTypes.STRING,
      status: {
        DataTypes: STRING,
        default: 1,
      },
      remark: DataTypes.STRING,
    },
    {
      paranoid: true,
    }
  );

  return UserInstance;
};
