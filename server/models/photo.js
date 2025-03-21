module.exports = (sequelize, DataTypes) => {
  const photo = sequelize.define(
    "photo",
    {
      imageUrl: {
        type: DataTypes.STRING,
        allow: false,
      },
      description: {
        type: DataTypes.STRING,
      },
      altDescription: {
        type: DataTypes.STRING,
      },
      dateSaved: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      userId: {
        type: DataTypes.INTEGER,
        references: { model: "user", key: "id" },
      },
    },
    {
      timestamps: true,
    }
  )

  photo.associate = (models) => {
    photo.hasMany(models.tag, { foreignKey: "photoId" })
  }
  return photo
}
