import Joi from 'joi';

export const validateMenuItem = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(255).required(),
    price: Joi.number().positive().required(),
    description: Joi.string().max(1000).allow(''),
    category_id: Joi.string().uuid().required(),
    restaurant_id: Joi.string().uuid().required()
  });

  const { error, value } = schema.validate(data);
  if (error) throw new Error(error.details[0].message);
  return value;
};

export const validateRestaurant = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    tagline: Joi.string().max(255).allow(''),
    color: Joi.string().pattern(/^#[0-9A-F]{6}$/i).required(),
    phone: Joi.string().pattern(/^\+?[0-9\s\-()]{7,}$/).allow(''),
    email: Joi.string().email().allow('')
  });

  const { error, value } = schema.validate(data);
  if (error) throw new Error(error.details[0].message);
  return value;
};

export const validateUsername = (username) => {
  const schema = Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required();

  const { error, value } = schema.validate(username);
  if (error) throw new Error('Invalid username');
  return value;
};

export const validatePassword = (password) => {
  const schema = Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain letters, numbers, and special characters'
    });

  const { error, value } = schema.validate(password);
  if (error) throw new Error(error.message);
  return value;
};
