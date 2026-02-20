import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

interface UserAttributes {
  id: number;
  email: string;
  password_hash: string;
  name?: string | null;
  professional_title?: string | null;
  professional_description?: string | null;
  rate?: string | null;
  hours_per_day?: string | null;
  days_per_week?: number | null;
  level?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

interface UserCreationAttributes
  extends Optional<
    UserAttributes,
    | 'id'
    | 'name'
    | 'professional_title'
    | 'professional_description'
    | 'rate'
    | 'hours_per_day'
    | 'days_per_week'
    | 'level'
    | 'created_at'
    | 'updated_at'
  > {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public email!: string;
  public password_hash!: string;
  public name!: string | null;
  public professional_title!: string | null;
  public professional_description!: string | null;
  public rate!: string | null;
  public hours_per_day!: string | null;
  public days_per_week!: number | null;
  public level!: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'name',
    },
    professional_title: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'professional_title',
    },
    professional_description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'professional_description',
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'rate',
    },
    hours_per_day: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      field: 'hours_per_day',
    },
    days_per_week: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'days_per_week',
    },
    level: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'level',
    },
    created_at: {
      type: DataTypes.DATE,
      field: 'created_at',
    },
    updated_at: {
      type: DataTypes.DATE,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          const salt = await bcrypt.genSalt(10);
          user.password_hash = await bcrypt.hash(user.password_hash, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          const salt = await bcrypt.genSalt(10);
          user.password_hash = await bcrypt.hash(user.password_hash, salt);
        }
      },
    },
  }
);

export default User;
