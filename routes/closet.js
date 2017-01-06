var express = require('express');
var mysql = require('mysql');
var aws = require('aws-sdk');
var multer = require('multer');
var multerS3 = require('multer-s3');
var router = express.Router();
var pool = mysql.createPool({
  host : db_config.host,
  port : db_config.port,
  user : db_config.user,
  password : db_config.password,
  database : db_config.database,
  connectionLimit : db_config.connectionLimit
});


// router.get('/backback',function(req,res,next){
//   res.render('closet/put_your_cloth', { title: 'The index page!' })
// });

//내 옷장 보기 (complete)
router.get('/:user_id/:category', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      connection.query('select * from closet where cloth_owner_id = ? and category = ?', [req.params.user_id, req.params.category], function(error, rows) {
        if (error){
          console.log("Connection Error" + error);
          res.sendStatus(500);
        }
        else {
          res.status(200).send({closet : rows});
        }
        connection.release();
      });
    }
  });
});


//사용자가 직접 옷을 등록(complete)
router.post('/put_your_cloth', upload.single('file'), function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else{
      if(req.file){
        var sql = 'insert into closet(is_basic, cloth_owner_id, cloth_image, cloth_id, category, color, memo) values(?,?,?,?,?,?,?)';
        var insert = ['false',req.body.user_id, req.file.location, req.body.cloth_id, req.body.category, req.body.color, req.body.memo];
        connection.query(sql, insert, function(error, rows){
         if (error){
           console.log("Connection Error" + error);
           res.sendStatus(500);
         }
         else {
            res.status(201).send({message : 'done'});
            connection.release();
         }
       });
      }
    }
  });
});



//옷장에서 옷 삭제 (complete)
router.get('/delete/delete_cloth/:id', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else {
      connection.query('delete from closet where id = ?', [req.params.id], function(error, rows) {
        if (error){
          console.log("Connection Error" + error);
          res.sendStatus(500);
        }
        else {
          res.status(200).send({message : 'done'});
          connection.release();
        }
      });
    }
  });
});



// 기본템 등록 시 기본템 사용자한테 보여주기 (complete)
router.get('/put_basic_cloth/show_basic_items/:category', function(req, res, next) {
  pool.getConnection(function(error, connection){
    if (error){
      console.log("getConnection Error" + error);
      res.sendStatus(500);
    }
    else{
          connection.query('select * from basic_items where category = ?',[req.params.category], function(error, rows){
           if (error){
             console.log("Connection Error" + error);
             res.sendStatus(500);
           }
           else {
              res.status(201).send({basic_items : rows});
              connection.release();
           }
         });
    }
  });
});

//사용자가 기본템 등록
router.post('/put_basic_cloth', function(req, res, next) {
    pool.getConnection(function(error, connection){
      if (error){
        console.log("getConnection Error" + error);
        res.sendStatus(500);
      }
      else {
          var howMany = req.body.item_id.length;
          var chosen_image = ' '; //select 된 이미지url을 저장할 변수

          for(var i = 0; i<howMany; i++){
            connection.query('select * from basic_items where id=?',[req.body.item_id[i]], function(error, rows){
              if (error){
                 console.log("Connection Error" + error);
                 res.sendStatus(500);
              }
              else {
                connection.query('select * from closet where basic_id = ? and cloth_owner_id = ?', [rows[0].id, req.body.user_id], function(error, result){
                  if (error){
                     console.log("Connection Error" + error);
                     res.sendStatus(500);
                  }
                  else{
                    if(result.length!==0){
                      console.log('already exist');
                    }
                    else{
                      chosen_image = rows[0].item_image;
                      var sql =  'insert into closet(is_basic, basic_id, cloth_owner_id, cloth_id, cloth_image, category, color, memo) values(?,?,?,?,?,?,?,?)';
                      var values = ["true", rows[0].id, req.body.user_id, rows[0].item_id, chosen_image, rows[0].category, rows[0].color, null];
                      connection.query(sql, values, function(error, rows){
                             if (error){
                               console.log("Connection Error" + error);
                               res.sendStatus(500);
                             }
                             else {
                                console.log('add success');
                             }
                      });
                    }
                  }
                });
              }
            });
          }  connection.release(); res.status(201).send({message : 'done'});
        }
      });
    });


module.exports = router;
