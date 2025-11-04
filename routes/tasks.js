module.exports = function (router) {
    var Task = require('../models/task');
    var User = require('../models/user');

    // GET /api/tasks - 获取任务列表（支持查询参数）
    router.route('/tasks')
        .get(function (req, res) {
            // 处理查询参数：where, sort, select, skip, limit, count
            var query = Task.find();

            // where 参数
            if (req.query.where) {
                try {
                    var whereCondition = JSON.parse(req.query.where);
                    query = Task.find(whereCondition);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid where parameter",
                        data: {}
                    });
                }
            }

            // sort 参数
            if (req.query.sort) {
                try {
                    var sortCondition = JSON.parse(req.query.sort);
                    query = query.sort(sortCondition);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid sort parameter",
                        data: {}
                    });
                }
            }

            // select 参数
            if (req.query.select) {
                try {
                    var selectCondition = JSON.parse(req.query.select);
                    query = query.select(selectCondition);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid select parameter",
                        data: {}
                    });
                }
            }

            // skip 参数
            if (req.query.skip) {
                query = query.skip(parseInt(req.query.skip));
            }

            // limit 参数（默认100）
            if (req.query.limit) {
                query = query.limit(parseInt(req.query.limit));
            } else {
                query = query.limit(100);
            }

            // count 参数
            if (req.query.count === 'true') {
                query.countDocuments().then(function (count) {
                    res.status(200).json({
                        message: "OK",
                        data: count
                    });
                }).catch(function (err) {
                    res.status(500).json({
                        message: "Error counting tasks",
                        data: {}
                    });
                });
                return;
            }

            // 执行查询
            query.exec().then(function (tasks) {
                res.status(200).json({
                    message: "OK",
                    data: tasks
                });
            }).catch(function (err) {
                res.status(500).json({
                    message: "Error retrieving tasks",
                    data: {}
                });
            });
        })

        // POST /api/tasks - 创建新任务
        .post(function (req, res) {
            // 验证必需字段
            if (!req.body.name || !req.body.deadline) {
                return res.status(400).json({
                    message: "Name and deadline are required",
                    data: {}
                });
            }

            // 处理 deadline - 可能是数字时间戳或日期字符串
            var deadline = req.body.deadline;
            // urlencoded 数据中所有值都是字符串，需要先转换为数字
            if (typeof deadline === 'string') {
                if (!isNaN(deadline) && deadline.trim() !== '') {
                    deadline = new Date(parseInt(deadline));
                } else {
                    deadline = new Date(deadline);
                }
            } else if (typeof deadline === 'number') {
                deadline = new Date(deadline);
            }

            // 处理 completed - 可能是字符串 "true"/"false" 或布尔值
            var completed = false;
            if (req.body.completed !== undefined) {
                if (typeof req.body.completed === 'string') {
                    completed = req.body.completed.toLowerCase() === 'true';
                } else {
                    completed = req.body.completed;
                }
            }

            var task = new Task({
                name: req.body.name,
                description: req.body.description || "",
                deadline: deadline,
                completed: completed,
                assignedUser: req.body.assignedUser || "",
                assignedUserName: req.body.assignedUserName || "unassigned",
                dateCreated: req.body.dateCreated || Date.now()
            });

            task.save().then(function (savedTask) {
                // 如果任务被分配且未完成，更新用户的 pendingTasks
                if (savedTask.assignedUser && savedTask.assignedUser !== "" && !savedTask.completed) {
                    User.findById(savedTask.assignedUser).then(function (user) {
                        if (user) {
                            if (user.pendingTasks.indexOf(savedTask._id.toString()) === -1) {
                                user.pendingTasks.push(savedTask._id.toString());
                                user.save().catch(function (err) {
                                    console.error('Error updating user pendingTasks:', err);
                                });
                            }
                        }
                    }).catch(function (err) {
                        console.error('Error finding user:', err);
                        // 忽略错误，继续返回任务
                    });
                }

                res.status(201).json({
                    message: "Task created successfully",
                    data: savedTask
                });
            }).catch(function (err) {
                console.error('Error creating task:', err);
                res.status(400).json({
                    message: "Error creating task: " + (err.message || "Unknown error"),
                    data: {}
                });
            });
        });

    // GET /api/tasks/:id - 获取特定任务
    router.route('/tasks/:id')
        .get(function (req, res) {
            var query = Task.findById(req.params.id);

            // select 参数
            if (req.query.select) {
                try {
                    var selectCondition = JSON.parse(req.query.select);
                    query = query.select(selectCondition);
                } catch (e) {
                    return res.status(400).json({
                        message: "Invalid select parameter",
                        data: {}
                    });
                }
            }

            query.exec().then(function (task) {
                if (!task) {
                    return res.status(404).json({
                        message: "Task not found",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: task
                });
            }).catch(function (err) {
                res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            });
        })

        // PUT /api/tasks/:id - 更新任务
        .put(function (req, res) {
            // 验证必需字段
            if (!req.body.name || !req.body.deadline) {
                return res.status(400).json({
                    message: "Name and deadline are required",
                    data: {}
                });
            }

            // 处理 deadline - 可能是数字时间戳或日期字符串
            var deadline = req.body.deadline;
            // urlencoded 数据中所有值都是字符串，需要先转换为数字
            if (typeof deadline === 'string') {
                if (!isNaN(deadline) && deadline.trim() !== '') {
                    deadline = new Date(parseInt(deadline));
                } else {
                    deadline = new Date(deadline);
                }
            } else if (typeof deadline === 'number') {
                deadline = new Date(deadline);
            }

            // 处理 completed - 可能是字符串 "true"/"false" 或布尔值
            var completed = false;
            if (req.body.completed !== undefined) {
                if (typeof req.body.completed === 'string') {
                    completed = req.body.completed.toLowerCase() === 'true';
                } else {
                    completed = req.body.completed;
                }
            }

            // 先获取旧任务信息
            Task.findById(req.params.id).then(function (oldTask) {
                if (!oldTask) {
                    return res.status(404).json({
                        message: "Task not found",
                        data: {}
                    });
                }

                var oldAssignedUser = oldTask.assignedUser;
                var oldCompleted = oldTask.completed;

                // 更新任务
                return Task.findByIdAndUpdate(
                    req.params.id,
                    {
                        name: req.body.name,
                        description: req.body.description || "",
                        deadline: deadline,
                        completed: completed,
                        assignedUser: req.body.assignedUser || "",
                        assignedUserName: req.body.assignedUserName || "unassigned",
                        dateCreated: req.body.dateCreated || Date.now()
                    },
                    { new: true, runValidators: true }
                ).then(function (task) {
                    if (!task) {
                        return res.status(404).json({
                            message: "Task not found",
                            data: {}
                        });
                    }

                    // 处理双向引用：更新用户的 pendingTasks
                    // 如果旧用户存在，从旧用户的 pendingTasks 中移除
                    if (oldAssignedUser && oldAssignedUser !== "") {
                        User.findById(oldAssignedUser).then(function (oldUser) {
                            if (oldUser) {
                                var index = oldUser.pendingTasks.indexOf(req.params.id);
                                if (index > -1) {
                                    oldUser.pendingTasks.splice(index, 1);
                                    oldUser.save();
                                }
                            }
                        }).catch(function (err) {
                            // 忽略错误
                        });
                    }

                    // 如果新用户存在且任务未完成，添加到新用户的 pendingTasks
                    if (task.assignedUser && task.assignedUser !== "" && !task.completed) {
                        User.findById(task.assignedUser).then(function (newUser) {
                            if (newUser) {
                                if (newUser.pendingTasks.indexOf(task._id.toString()) === -1) {
                                    newUser.pendingTasks.push(task._id.toString());
                                    newUser.save();
                                }
                            }
                        }).catch(function (err) {
                            // 忽略错误
                        });
                    }

                    res.status(200).json({
                        message: "Task updated successfully",
                        data: task
                    });
                });
            }).catch(function (err) {
                console.error('Error updating task:', err);
                res.status(400).json({
                    message: "Error updating task: " + (err.message || "Unknown error"),
                    data: {}
                });
            });
        })

        // DELETE /api/tasks/:id - 删除任务
        .delete(function (req, res) {
            Task.findById(req.params.id).then(function (task) {
                if (!task) {
                    return res.status(404).json({
                        message: "Task not found",
                        data: {}
                    });
                }

                var assignedUser = task.assignedUser;

                // 删除任务
                return Task.findByIdAndDelete(req.params.id).then(function () {
                    // 从用户的 pendingTasks 中移除该任务
                    if (assignedUser && assignedUser !== "") {
                        User.findById(assignedUser).then(function (user) {
                            if (user) {
                                var index = user.pendingTasks.indexOf(req.params.id);
                                if (index > -1) {
                                    user.pendingTasks.splice(index, 1);
                                    user.save();
                                }
                            }
                        }).catch(function (err) {
                            // 忽略错误
                        });
                    }

                    res.status(204).send();
                });
            }).catch(function (err) {
                res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            });
        });

    return router;
}
