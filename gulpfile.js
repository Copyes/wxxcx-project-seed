var path = require('path')
var fs = require('fs')

var gulp = require('gulp')
var postcss = require('gulp-postcss')
var autoprefixer = require('autoprefixer')
var babel = require('gulp-babel')
var gulpsync = require('gulp-sync')(gulp)
var rename = require('gulp-rename')
var gulpless = require('gulp-less')
var eslint = require('gulp-eslint')
var stripJsonComments = require('gulp-strip-json-comments')

//以下的模块是为了尝试监听less的错误（监听不全）
var plumber = require('gulp-plumber')
var gutil = require('gulp-util')
var through = require('through2')
var notify = require('gulp-notify')
var exec = require('child_process').exec

var SRC_PATH = 'src'
var DIST_PATH = 'dist'

//代码着色和显示错误日志
// var handleError = function() {
//     var args = Array.prototype.slice.call(arguments);
//     notify.onError({
//         title: 'compile error',
//         message: '<%=error.message %>'
//     }).apply(this, args); //替换为当前对象
//     this.emit('end'); //提交
// };

//打印log
var logStream = function(text) {
  return through.obj(function(file, env, callback) {
    gutil.log(gutil.colors.blue(file.relative) + ' ' + text)
    callback(null, file)
  })
}

//遍历文件夹，删删删！！之前的会在windows上面存在bug
var deleteFolderRecursive = function(path) {
  if (!path || path !== './' + DIST_PATH) {
    return
  } else {
    exec('rm -r ' + path)
  }
}

var compileJs = function(path, distPath) {
  return gulp
    .src(path)
    .pipe(logStream(distPath ? '开始更新' : 'task start'))
    .pipe(plumber())
    .pipe(
      babel({
        presets: ['es2015'],
        plugins: ['add-module-exports']
      })
    )
    .pipe(logStream(distPath ? '结束更新' : 'task end'))
    .pipe(gulp.dest(distPath || DIST_PATH))
}

var compileLess = function(path, distPath) {
  return gulp
    .src(path)
    .pipe(logStream(distPath ? '开始更新' : 'task start'))
    .pipe(plumber())
    .pipe(gulpless())
    .pipe(postcss([autoprefixer]))
    .pipe(
      rename(function(path) {
        path.dirname += '/'
        path.extname = '.wxss'
      })
    )
    .pipe(logStream(distPath ? '结束更新' : 'task end'))
    .pipe(gulp.dest(distPath || DIST_PATH))
}

var stripJson = function(path, distPath) {
  return gulp
    .src(path)
    .pipe(logStream(distPath ? '开始更新' : 'task start'))
    .pipe(stripJsonComments())
    .pipe(logStream(distPath ? '结束更新' : 'task end'))
    .pipe(gulp.dest(distPath || DIST_PATH))
}

var copyFile = function(path, distPath) {
  return gulp
    .src(path)
    .pipe(gulp.dest(distPath || DIST_PATH))
    .pipe(logStream('复制完毕'))
}

//为了不引起冲突，然后我们在打包的时候还是要清理下以前的文件
gulp.task('remove', function() {
  deleteFolderRecursive('./' + DIST_PATH, function() {
    gutil.log(gutil.colors.red('Remove ok'))
  })
})

//定义一个打包js的任务
gulp.task('js', function() {
  return compileJs(SRC_PATH + '/**/*.js')
})

//定义一个编译less的任务
gulp.task('less', function() {
  return compileLess([SRC_PATH + '/**/*.wxss', SRC_PATH + '/**/*.less'])
})

// 去除json注释
gulp.task('json', function() {
  return stripJson(SRC_PATH + '/**/*.json')
})

//移动文件夹pages从src到dist
gulp.task('copy', function() {
  return copyFile([SRC_PATH + '/**/*.wxml', SRC_PATH + '/**/*.png', SRC_PATH + '/**/*.jpg'])
})
//是不是还是要一个单独的任务来打包其他的任务呢？
//上个eslint
gulp.task('lint', function() {
  return gulp
    .src([SRC_PATH + '/**/*.js'])
    .pipe(
      eslint({
        configFle: './.eslintrc'
      })
    )
    .pipe(eslint.format())
})

gulp.task('all', gulpsync.sync(['remove', 'js', 'less', 'json', 'copy']), function() {
  gutil.log(gutil.colors.yellow('All done'))
})

//监听所有文件变化
gulp.task('watch', function() {
  gulp.watch(SRC_PATH + '/**').on('change', function(event) {
    var filePath = event.path
    var extname = path.extname(filePath)
    var distPath = path
      .dirname(filePath)
      .replace(new RegExp('^' + __dirname + '/'), '')
      .replace(new RegExp(SRC_PATH), DIST_PATH)
    if (extname === '.js') {
      compileJs(filePath, distPath)
    } else if (extname === '.json') {
      stripJson(filePath, distPath)
    } else if (extname === '.less') {
      compileLess(filePath, distPath)
    } else if (extname === '.wxml' || extname === '.png' || extname === '.jpg') {
      copyFile(filePath, distPath)
    }
  })
})

gulp.task('addPage', function() {
  if (!gulp.env.name) {
    console.log('请输入页面的英文名称并使用如下命令：gulp addPage --name test')
  }
  var name = gulp.env.name
  var dirpath = SRC_PATH + '/pages/' + name
  var htmlPath = dirpath + '/' + name + '.wxml'
  var lessPath = dirpath + '/' + name + '.less'
  var jsPath = dirpath + '/' + name + '.js'
  var jsContent = `Page({
    data: {},
    onLoad: function () {
    },
    onReady: function(){
    }
});`
  fs.exists(SRC_PATH + '/pages/' + name, function(exists) {
    if (exists) {
      gutil.log(gutil.colors.red(name + ' 该页面已存在!'))
      return
    } else {
      fs.mkdir(dirpath, function() {
        fs.writeFile(htmlPath, '', function(err) {
          console.log('创建 xwml 文件' + (err ? '失败' : '成功'))
        })
        fs.writeFile(lessPath, '', function(err) {
          console.log('创建 less 文件' + (err ? '失败' : '成功'))
        })
        fs.writeFile(jsPath, jsContent, function(err) {
          console.log('创建 js 文件' + (err ? '失败' : '成功'))
        })
      })
      fs.readFile(SRC_PATH + '/app.json', 'utf8', function(err, data) {
        if (err) gutil.log(gutil.colors.red('配置app.json失败！'))
        try {
          var currentObj = JSON.parse(data)
          currentObj.pages.push('pages/' + name + '/' + name)
          fs.writeFile(SRC_PATH + '/app.json', JSON.stringify(currentObj, null, 4))
          console.log('配置 app.json 成功')
        } catch (e) {
          gutil.log(gutil.colors.red('配置app.json失败！'))
        }
      })
    }
  })
})

gulp.task('default', ['all', 'watch'], function() {
  gutil.log(gutil.colors.yellow('default done'))
})
