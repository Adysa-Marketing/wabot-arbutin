"use strict";

module.exports = (sequelize, DataTypes) => {
  const WaBot = sequelize.define(
    "WaBot",
    {
      name: DataTypes.STRING,
      key: DataTypes.STRING,
      phone: DataTypes.STRING,
      status: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
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

  return WaBot;
};
