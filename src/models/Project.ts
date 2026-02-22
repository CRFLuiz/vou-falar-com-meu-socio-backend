import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProjectAttributes {
  id: number;
  name: string;
  description?: string;
  status: string;
  
  // Stage Data
  discovery_data?: any;
  risk_analysis_data?: any;
  architecture_data?: any;
  engineering_data?: any;
  risk_intel_data?: any;
  estimation_data?: any;
  documents_data?: any;

  created_at?: Date;
  updated_at?: Date;
}

interface ProjectCreationAttributes
  extends Optional<
    ProjectAttributes,
    | 'id'
    | 'description'
    | 'status'
    | 'discovery_data'
    | 'risk_analysis_data'
    | 'architecture_data'
    | 'engineering_data'
    | 'risk_intel_data'
    | 'estimation_data'
    | 'documents_data'
    | 'created_at'
    | 'updated_at'
  > {}

class Project extends Model<ProjectAttributes, ProjectCreationAttributes> implements ProjectAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public status!: string;

  public discovery_data!: any;
  public risk_analysis_data!: any;
  public architecture_data!: any;
  public engineering_data!: any;
  public risk_intel_data!: any;
  public estimation_data!: any;
  public documents_data!: any;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Project.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
    },
    discovery_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    risk_analysis_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    architecture_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    engineering_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    risk_intel_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    estimation_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    documents_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'projects',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Project;
