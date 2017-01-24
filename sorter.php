<?php
/**
* Сортировщик фоток по папочкам. Читает инфу из экзив данных
* раскладывает следующим способом:
* Год/номерМесяца-названиеМесяца/модельКамеры/file.jpg
* @author Seyar Chapuh seyarchapuh@ya.ru
*/
$arguments = getopt("a::",array("help::"));

if(isset($arguments['help']) ){
	echo "Usage: php sorter.php [OPTION]...\nProgramm for sorting photo. Sort by EXIF info \n".
	     "Files will move to ./{year}/{num-month}-{month name}/{Camera name}/\n".
	     "  -a\tMove all photos, default 5 photos\n\n";
	die;
}

date_default_timezone_set('Europe/Kiev');

define( 'ALL', (isset($arguments['a']) && $arguments['a'] === FALSE) );
// define( 'DOCROOT', getcwd() );
define( 'DOCROOT', '/Users/seyar/media/photos' );
define( 'SOURCEROOT', getcwd() );
if (!is_dir(DOCROOT)) {
    mkdir( DOCROOT, 0755, true );
}
//if( ALL ) error_reporting(0);


$files = scandir(SOURCEROOT);
array_shift($files);
array_shift($files);
$i = 0;
$folders = array();
foreach( $files as $item)
{
	// if($i > 5 && !ALL ) die("5 вышло\n");

	if(is_file($item) && (strtolower(substr($item, -3)) == 'jpg'))
	{
		$i++;
		$image = SOURCEROOT.'/'.$item;
		//if( !is_file($image) ) die('не файло'."\n");
		$exif = exif_read_data($image, 0, true);

		$date = (isset($exif['EXIF']['DateTimeOriginal']) ? $exif['EXIF']['DateTimeOriginal'] : (isset($exif['EXIF']['DateTimeDigitized']) ? $exif['EXIF']['DateTimeDigitized'] : '' ) );
		$camera = isset($exif['IFD0']['Model']) ?  str_replace(array(' ', '/','\\',','),'_',$exif['IFD0']['Model']) : '';
		$path = generatePath($date, $camera);
		if( !$path ) continue;

		$fullpath = DOCROOT.'/'.$path;
		if( !is_dir($fullpath) ) mkdir($fullpath,0755,true);

		if( copy($image, $fullpath.basename($image)) )
		{
			 echo dirname($fullpath)."/$camera/".basename($image)."\n";
			 unlink($image);
		}
		else
			echo $image.' = '.$fullpath.basename($image)." not moved\n";

	}
}
die();


function generatePath( $date = NULL, $camera = '' )
{
	if( !isset($date) || empty($date) ) return false;

	$path = date('Y/n-F/', strtotime($date)).$camera.'/';
	return $path;
}

/*
$files = scandir(dirname(__FILE__));
array_shift($files);
array_shift($files);
$i = 0;
$folders = array();
foreach( $files as $item)
{

	if($i > 5 && (!isset($argv[1]) || $argv[1] != 'prod')) die();

	if(is_file($item))
	{
		$i++;
		$image = dirname(__FILE__).'/'.$item;
		if( !is_file($image) ) die('не файло'."\n");

		$exif = exif_read_data($image, 0, true);

		if($exif):
		foreach ($exif as $key => $section) {
			foreach ($section as $name => $val)
			{
				if( $key.$name == 'IFD0Model' )
					$folders[] = str_replace(' ','_',$val);
			}
		}
		endif;
	}
}

array_unique($folders);
foreach($folders as $item)
{
	$folder = dirname(__FILE__).'/'.$item;
	if(!file_exists($folder))
	{
		mkdir( $folder, 0755, true);
		echo $item." -created\n";
	}
}
* */
?>
