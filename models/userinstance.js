"use strict";

const { STRING, NUMBER } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const UserInstance = sequelize.define(
    "UserInstance",
    {
      name: DataTypes.STRING,
      key: DataTypes.STRING,
      status: {
        DataTypes: NUMBER,
        defaultValue: 1,
        allowNull: false,
        validate: {
          customValidator: (value) => {
            const enums = [0, 1];
            if (!enums.includes(value)) {
              throw new Error("not a valid option");
            }
          },
        },
      },
      remark: DataTypes.STRING,
    },
    {
      paranoid: true,
    }
  );

  return UserInstance;
};
